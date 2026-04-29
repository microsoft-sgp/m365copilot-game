import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { generatePlayerToken, hashPlayerToken } from '../lib/playerAuth.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));

import { getPool } from '../lib/db.js';
import { handler } from './updateSession.js';

function tokenedRequest({ params, body, token }) {
  const headers = token ? { cookie: `${PLAYER_COOKIE_NAME}=${token}` } : {};
  return fakeRequest({ params, body, headers });
}

describe('updateSession token enforcement (flag on)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT; // default-on
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('returns 401 when no token is presented', async () => {
    const { pool } = createMockPool([
      { recordset: [{ owner_token: hashPlayerToken('real') }] }, // ownership lookup
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(tokenedRequest({ params: { id: '42' }, body: {} }));
    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Unauthorized' });
  });

  it('returns 401 when the token does not match the owner hash', async () => {
    const { pool } = createMockPool([
      { recordset: [{ owner_token: hashPlayerToken(generatePlayerToken()) }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ params: { id: '42' }, body: {}, token: 'attacker' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the session row does not exist (auth fails closed)', async () => {
    const { pool } = createMockPool([
      { recordset: [] }, // ownership lookup: no row
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({ params: { id: '42' }, body: {}, token: 'whatever' }),
    );
    // Missing row → ownership check fails → 401 (no oracle distinguishing
    // existence from missing token).
    expect(res.status).toBe(401);
  });

  it('passes through to the UPDATE when the token matches', async () => {
    const token = generatePlayerToken();
    const { pool, calls } = createMockPool([
      { recordset: [{ owner_token: hashPlayerToken(token) }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      tokenedRequest({
        params: { id: '42' },
        body: { tilesCleared: 5 },
        token,
      }),
    );
    expect(res.jsonBody).toEqual({ ok: true });
    expect(calls[1].query).toMatch(/UPDATE game_sessions/);
  });

  it('accepts the token from the X-Player-Token header when no cookie is present', async () => {
    const token = generatePlayerToken();
    const { pool } = createMockPool([
      { recordset: [{ owner_token: hashPlayerToken(token) }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(
      fakeRequest({
        params: { id: '42' },
        body: {},
        headers: { 'x-player-token': token },
      }),
    );
    expect(res.jsonBody).toEqual({ ok: true });
  });
});

describe('updateSession token enforcement (flag off, rollout safety)', () => {
  let prevEnforce;
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    prevEnforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = 'false';
  });
  afterEach(() => {
    if (prevEnforce === undefined) delete process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT;
    else process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT = prevEnforce;
  });

  it('passes through without ownership lookup or token', async () => {
    const { pool, calls } = createMockPool([{ recordset: [], rowsAffected: [1] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(fakeRequest({ params: { id: '42' }, body: {} }));
    expect(res.jsonBody).toEqual({ ok: true });
    expect(calls).toHaveLength(1); // only the UPDATE, no ownership SELECT
    expect(calls[0].query).toMatch(/UPDATE game_sessions/);
  });
});
