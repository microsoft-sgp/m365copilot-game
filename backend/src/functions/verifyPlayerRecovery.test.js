import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/cache.js', () => ({
  cacheDelete: vi.fn(),
  cacheGetCounter: vi.fn(),
  cacheIncrementWithTtl: vi.fn(),
}));

import { getPool } from '../lib/db.js';
import { cacheDelete, cacheGetCounter, cacheIncrementWithTtl } from '../lib/cache.js';
import { handler } from './verifyPlayerRecovery.js';

function context() {
  return { log: vi.fn(), error: vi.fn() };
}

function request(email = 'ada@example.com', code = '123456') {
  return fakeRequest({ body: { email, code } });
}

describe('verifyPlayerRecovery', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(cacheDelete).mockReset();
    vi.mocked(cacheGetCounter).mockReset();
    vi.mocked(cacheIncrementWithTtl).mockReset();
    vi.mocked(cacheGetCounter).mockResolvedValue(0);
    vi.mocked(cacheIncrementWithTtl).mockResolvedValue(1);
    vi.mocked(cacheDelete).mockResolvedValue(undefined);
  });

  it('issues a new player token and cookie for a valid code', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 50 }], rowsAffected: [1] },
      { recordset: [{ id: 11 }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request(), context());

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.cookies?.[0]?.name).toBe(PLAYER_COOKIE_NAME);
    expect(res.cookies?.[0]?.value).toBe(res.jsonBody.playerToken);
    expect(calls[0].query).toMatch(/UPDATE player_recovery_otps/);
    expect(calls[2].query).toMatch(/INSERT INTO player_device_tokens/);
    expect(cacheDelete).toHaveBeenCalled();
  });

  it('rejects missing fields', async () => {
    const res = await handler(fakeRequest({ body: { email: 'ada@example.com' } }), context());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Email and code are required' });
  });

  it('returns 401 and increments lockout counter for an invalid code', async () => {
    const { pool } = createMockPool([{ recordset: [], rowsAffected: [0] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request(), context());

    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Invalid or expired code' });
    expect(cacheIncrementWithTtl).toHaveBeenCalled();
  });

  it('locks out after too many invalid attempts', async () => {
    vi.mocked(cacheGetCounter).mockResolvedValueOnce(5);

    const res = await handler(request(), context());

    expect(res.status).toBe(429);
    expect(getPool).not.toHaveBeenCalled();
  });

  it('only lets one redemption of the same code issue a token', async () => {
    const first = createMockPool([
      { recordset: [{ id: 50 }], rowsAffected: [1] },
      { recordset: [{ id: 11 }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const second = createMockPool([{ recordset: [], rowsAffected: [0] }]);
    vi.mocked(getPool).mockResolvedValueOnce(first.pool).mockResolvedValueOnce(second.pool);

    const ok = await handler(request(), context());
    const rejected = await handler(request(), context());

    expect(ok.jsonBody.ok).toBe(true);
    expect(rejected.status).toBe(401);
    expect(second.calls).toHaveLength(1);
  });
});
