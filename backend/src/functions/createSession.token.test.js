import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { generatePlayerToken, hashPlayerToken } from '../lib/playerAuth.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/packAssignments.js', () => ({
  isPackAssignmentLifecycleEnabled: vi.fn(),
  resolvePackAssignment: vi.fn(),
}));
vi.mock('../lib/organizations.js', () => ({
  resolveOrganizationForEmail: vi.fn(),
}));

import { getPool } from '../lib/db.js';
import { isPackAssignmentLifecycleEnabled, resolvePackAssignment } from '../lib/packAssignments.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './createSession.js';

function tokenedRequest({ body, token }) {
  const headers = token ? { cookie: `${PLAYER_COOKIE_NAME}=${token}` } : {};
  return fakeRequest({ body, headers });
}

describe('createSession player token issuance', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(false);
    vi.mocked(resolvePackAssignment).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: null,
      requiresOrganization: false,
    });
  });

  it('issues a fresh token, sets cookie, and stores hash on a brand-new player', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [] }, // resolvePlayerToken: no row
      { recordset: [{ id: 11 }] }, // upsertPlayer
      { recordset: [], rowsAffected: [1] }, // device token insert
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
      }),
    );

    expect(res.jsonBody.ok).toBe(true);
    expect(typeof res.jsonBody.playerToken).toBe('string');
    expect(res.jsonBody.playerToken).toHaveLength(43);
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0].name).toBe(PLAYER_COOKIE_NAME);
    expect(res.cookies[0].httpOnly).toBe(true);
    expect(res.cookies[0].value).toBe(res.jsonBody.playerToken);

    // Upsert INSERT branch should carry the hash of the issued token.
    const upsertInputs = calls[1].inputs;
    expect(upsertInputs.ownerTokenHash).toBe(hashPlayerToken(res.jsonBody.playerToken));
    expect(calls[2].query).toMatch(/INSERT INTO player_device_tokens/);
  });

  it('reuses the same token when an existing player presents a matching one', async () => {
    const existingToken = generatePlayerToken();
    const existingHash = hashPlayerToken(existingToken);
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: existingHash }] }, // resolvePlayerToken: matches
      { recordset: [{ id: 11 }] }, // upsertPlayer
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
        token: existingToken,
      }),
    );

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.playerToken).toBe(existingToken);
  });

  it('returns recoverable 409 Identity in use when an existing player presents a wrong token', async () => {
    const realToken = generatePlayerToken();
    const realHash = hashPlayerToken(realToken);
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: realHash }] }, // resolvePlayerToken: mismatch
      { recordset: [] }, // no active device token match
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
        token: 'attacker-token',
      }),
    );

    expect(res.status).toBe(409);
    expect(res.jsonBody).toEqual({
      ok: false,
      code: 'PLAYER_RECOVERY_REQUIRED',
      message: 'Identity in use',
    });
  });

  it('returns 409 when an existing player has a token but the request has none', async () => {
    const realToken = generatePlayerToken();
    const realHash = hashPlayerToken(realToken);
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: realHash }] }, // existing with token
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
      }),
    );

    expect(res.status).toBe(409);
  });

  it('atomically claims a legacy player row with null owner_token', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11, owner_token: null }] }, // resolvePlayerToken: legacy row
      { recordset: [], rowsAffected: [1] }, // claim UPDATE: won
      { recordset: [{ id: 11 }] }, // upsertPlayer
      { recordset: [], rowsAffected: [1] }, // device token insert
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
      }),
    );

    expect(res.jsonBody.ok).toBe(true);
    expect(typeof res.jsonBody.playerToken).toBe('string');
    expect(calls[1].query).toMatch(/UPDATE players SET owner_token = @hash/);
    // The hash sent to the UPDATE matches the issued token.
    expect(calls[1].inputs.hash).toBe(hashPlayerToken(res.jsonBody.playerToken));
    expect(calls[3].query).toMatch(/INSERT INTO player_device_tokens/);
  });

  it('returns 409 when the legacy claim races and the presented token does not match the winner', async () => {
    const winnerHash = hashPlayerToken(generatePlayerToken());
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: null }] }, // legacy row at SELECT time
      { recordset: [], rowsAffected: [0] }, // claim UPDATE: lost
      { recordset: [{ owner_token: winnerHash }] }, // refetch
      { recordset: [] }, // no active device token match
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
        token: 'loser-token',
      }),
    );

    expect(res.status).toBe(409);
  });

  it('honours the presented token when the legacy claim races and the caller is the winner', async () => {
    const winnerToken = generatePlayerToken();
    const winnerHash = hashPlayerToken(winnerToken);
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: null }] }, // legacy row at SELECT time
      { recordset: [], rowsAffected: [0] }, // claim UPDATE: lost
      { recordset: [{ owner_token: winnerHash }] }, // refetch shows winner is the caller
      { recordset: [{ id: 11 }] }, // upsertPlayer
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
        token: winnerToken,
      }),
    );

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.playerToken).toBe(winnerToken);
  });

  it('resumes an existing player when a recovered active device token matches', async () => {
    const ownerToken = generatePlayerToken();
    const deviceToken = generatePlayerToken();
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: hashPlayerToken(ownerToken) }] },
      { recordset: [{ token_hash: hashPlayerToken(deviceToken) }] },
      { recordset: [], rowsAffected: [1] }, // device last_seen update
      { recordset: [{ id: 11 }] }, // upsertPlayer
      { recordset: [{ id: 99 }] }, // session insert
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
        token: deviceToken,
      }),
    );

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.playerToken).toBe(deviceToken);
  });
});

describe('createSession token issuance is independent of enforcement flag', () => {
  let prevEnforce;

  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(isPackAssignmentLifecycleEnabled).mockReturnValue(false);
    vi.mocked(resolveOrganizationForEmail).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: null,
      requiresOrganization: false,
    });
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    // Explicit rollout-mode setting: enforcement off for downstream endpoints,
    // but createSession MUST still issue the token so the database column gets
    // populated for the eventual flip-on.
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
  });

  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('still issues a token for new players when enforcement is off', async () => {
    const { pool } = createMockPool([
      { recordset: [] }, // resolvePlayerToken: no row
      { recordset: [{ id: 11 }] }, // upsert
      { recordset: [], rowsAffected: [1] }, // device token insert
      { recordset: [{ id: 99 }] }, // session
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        body: { sessionId: 's', playerName: 'Ada', packId: 1, email: 'ada@smu.edu.sg' },
      }),
    );

    expect(typeof res.jsonBody.playerToken).toBe('string');
    expect(res.cookies?.[0]?.name).toBe(PLAYER_COOKIE_NAME);
  });
});
