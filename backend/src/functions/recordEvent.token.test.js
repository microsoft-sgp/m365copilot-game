import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { generatePlayerToken, hashPlayerToken } from '../lib/playerAuth.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/organizations.js', () => ({ resolveOrganizationForEmail: vi.fn() }));

import { getPool } from '../lib/db.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { handler } from './recordEvent.js';

function tokenedRequest(body, token) {
  const headers = token ? { cookie: `${PLAYER_COOKIE_NAME}=${token}` } : {};
  return fakeRequest({ body, headers });
}

describe('recordEvent token enforcement (flag on)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: null });
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('returns 401 with no token, never inserts into tile_events', async () => {
    const { pool, calls } = createMockPool([
      {
        recordset: [
          {
            id: 1,
            player_id: 20,
            org_id: null,
            email: 'a@b.c',
            owner_token: hashPlayerToken('real'),
          },
        ],
      },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ gameSessionId: 1, tileIndex: 0, eventType: 'reveal' }),
    );

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(1); // ownership check only; no INSERT attempted
  });

  it('returns 401 when the token does not match', async () => {
    const { pool } = createMockPool([
      {
        recordset: [
          {
            id: 1,
            player_id: 20,
            org_id: null,
            email: 'a@b.c',
            owner_token: hashPlayerToken(generatePlayerToken()),
          },
        ],
      },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ gameSessionId: 1, tileIndex: 0, eventType: 'reveal' }, 'attacker'),
    );

    expect(res.status).toBe(401);
  });

  it('proceeds with the insert when the token matches', async () => {
    const token = generatePlayerToken();
    const { pool, calls } = createMockPool([
      {
        recordset: [
          {
            id: 1,
            player_id: 20,
            org_id: null,
            email: 'a@b.c',
            owner_token: hashPlayerToken(token),
          },
        ],
      },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ gameSessionId: 1, tileIndex: 0, eventType: 'reveal' }, token),
    );
    expect(res.jsonBody).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it('returns 400 (not 401) when the session itself does not exist', async () => {
    const { pool } = createMockPool([{ recordset: [] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ gameSessionId: 999, tileIndex: 0, eventType: 'reveal' }, 'whatever'),
    );
    expect(res.status).toBe(400);
  });
});

describe('recordEvent token enforcement (flag off, rollout safety)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(resolveOrganizationForEmail).mockResolvedValue({ orgId: null });
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('accepts a token-less request', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 1, player_id: 20, org_id: null, email: 'a@b.c', owner_token: null }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ gameSessionId: 1, tileIndex: 0, eventType: 'reveal' }),
    );
    expect(res.jsonBody).toEqual({ ok: true });
  });
});
