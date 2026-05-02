import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { generatePlayerToken, hashPlayerToken } from '../lib/playerAuth.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/organizations.js', () => ({ resolveOrganizationForEmail: vi.fn() }));

import { getPool } from '../lib/db.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './submitKeyword.js';

const VALID_KEYWORD = 'CO-APR26-042-R1-ABCD1234';

function body(overrides = {}) {
  return {
    org: 'Contoso',
    name: 'Ada',
    email: 'ada@contoso.com',
    keyword: VALID_KEYWORD,
    ...overrides,
  };
}

function tokenedRequest({ body, token }) {
  const headers = token ? { cookie: `${PLAYER_COOKIE_NAME}=${token}` } : {};
  return fakeRequest({ body, headers });
}

describe('submitKeyword token enforcement (flag on)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: 10,
      orgName: 'Contoso',
      requiresOrganization: false,
    });
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('returns 401 when an existing player has a token and the request has none', async () => {
    const realHash = hashPlayerToken(generatePlayerToken());
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11, owner_token: realHash }] }, // owner lookup
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ body: body() }));
    expect(res.status).toBe(401);
    // Stops before any INSERT into submissions.
    expect(calls).toHaveLength(1);
  });

  it('returns 401 when the token does not match the existing player', async () => {
    const realHash = hashPlayerToken(generatePlayerToken());
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: realHash }] },
      { recordset: [] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ body: body(), token: 'attacker' }));
    expect(res.status).toBe(401);
  });

  it('proceeds normally when the token matches the existing player', async () => {
    const token = generatePlayerToken();
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: hashPlayerToken(token) }] }, // owner lookup
      { recordset: [{ id: 11 }] }, // player MERGE
      { recordset: [], rowsAffected: [1] }, // submissions INSERT
      { recordset: [{ cnt: 0 }] }, // org dupe check
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ body: body(), token }));
    expect(res.jsonBody.ok).toBe(true);
  });

  it('allows token-less requests when the email maps to no existing player (new submitter)', async () => {
    const { pool } = createMockPool([
      { recordset: [] }, // owner lookup: no existing player
      { recordset: [{ id: 11 }] }, // player MERGE
      { recordset: [], rowsAffected: [1] }, // submissions INSERT
      { recordset: [{ cnt: 0 }] }, // org dupe check
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ body: body() }));
    expect(res.jsonBody.ok).toBe(true);
  });

  it('allows token-less requests when the existing player row has no owner_token (legacy)', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: null }] }, // owner lookup: legacy null token
      { recordset: [{ id: 11 }] }, // player MERGE
      { recordset: [], rowsAffected: [1] },
      { recordset: [{ cnt: 0 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ body: body() }));
    expect(res.jsonBody.ok).toBe(true);
  });
});

describe('submitKeyword token enforcement (flag off, rollout safety)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({
      orgId: 10,
      orgName: 'Contoso',
      requiresOrganization: false,
    });
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('skips the owner lookup entirely', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11 }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [{ cnt: 0 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ body: body() }));
    expect(res.jsonBody.ok).toBe(true);
    expect(calls).toHaveLength(3); // no owner lookup
  });
});
