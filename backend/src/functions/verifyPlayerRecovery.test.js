import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { PLAYER_COOKIE_NAME } from '../lib/playerCookies.js';

const { beginSpy, commitSpy, rollbackSpy } = vi.hoisted(() => ({
  beginSpy: vi.fn(),
  commitSpy: vi.fn(),
  rollbackSpy: vi.fn(),
}));

vi.mock('mssql', async () => {
  class Transaction {
    constructor(pool) {
      this.pool = pool;
    }

    async begin(level) {
      beginSpy(level);
    }

    request() {
      return this.pool.request();
    }

    async commit() {
      commitSpy();
    }

    async rollback() {
      rollbackSpy();
    }
  }

  return {
    default: {
      Int: 'Int',
      NVarChar: () => 'NVarChar',
      ISOLATION_LEVEL: { SERIALIZABLE: 'SERIALIZABLE' },
      Transaction,
    },
  };
});

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
    beginSpy.mockReset();
    commitSpy.mockReset();
    rollbackSpy.mockReset();
    vi.mocked(cacheGetCounter).mockResolvedValue(0);
    vi.mocked(cacheIncrementWithTtl).mockResolvedValue(1);
    vi.mocked(cacheDelete).mockResolvedValue(undefined);
  });

  it('issues a new player token and cookie for a valid code', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 50 }] },
      { recordset: [{ id: 11 }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request(), context());

    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.cookies?.[0]?.name).toBe(PLAYER_COOKIE_NAME);
    expect(res.cookies?.[0]?.value).toBe(res.jsonBody.playerToken);
    expect(beginSpy).toHaveBeenCalledWith('SERIALIZABLE');
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(rollbackSpy).not.toHaveBeenCalled();
    expect(calls[0].query).toMatch(/FROM player_recovery_otps/);
    expect(calls[0].query).toMatch(/WITH \(UPDLOCK, HOLDLOCK\)/);
    expect(calls[0].query).not.toMatch(/READPAST/);
    expect(calls[2].query).toMatch(/INSERT INTO player_device_tokens/);
    expect(calls[3].query).toMatch(/UPDATE player_recovery_otps SET used = 1/);
    expect(cacheDelete).toHaveBeenCalled();
  });

  it('rejects missing fields', async () => {
    const res = await handler(fakeRequest({ body: { email: 'ada@example.com' } }), context());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Email and code are required' });
  });

  it('returns 401 and increments lockout counter for an invalid code', async () => {
    const { pool } = createMockPool([{ recordset: [] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request(), context());

    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Invalid or expired code' });
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(rollbackSpy).not.toHaveBeenCalled();
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
      { recordset: [{ id: 50 }] },
      { recordset: [{ id: 11 }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const second = createMockPool([{ recordset: [] }]);
    vi.mocked(getPool).mockResolvedValueOnce(first.pool).mockResolvedValueOnce(second.pool);

    const ok = await handler(request(), context());
    const rejected = await handler(request(), context());

    expect(ok.jsonBody.ok).toBe(true);
    expect(rejected.status).toBe(401);
    expect(second.calls).toHaveLength(1);
  });

  it('rolls back and leaves the code unconsumed when token creation fails', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 50 }] },
      { recordset: [{ id: 11 }] },
      new Error('device token insert failed'),
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);
    const ctx = context();

    const res = await handler(request(), ctx);

    expect(res.status).toBe(503);
    expect(res.jsonBody).toEqual({
      ok: false,
      message: 'Could not verify recovery code. Please try again.',
    });
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).not.toHaveBeenCalled();
    expect(cacheIncrementWithTtl).not.toHaveBeenCalled();
    expect(calls.some((call) => /UPDATE player_recovery_otps SET used = 1/.test(call.query))).toBe(
      false,
    );
    expect(JSON.stringify(ctx.error.mock.calls)).not.toContain('123456');
    expect(JSON.stringify(ctx.error.mock.calls)).not.toContain('ada@example.com');
  });

  it('rejects a raced recovery-code redemption when the used marker no longer updates a row', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 50 }] },
      { recordset: [{ id: 11 }] },
      { recordset: [], rowsAffected: [1] },
      { recordset: [], rowsAffected: [0] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request(), context());

    expect(res.status).toBe(401);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Invalid or expired code' });
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).not.toHaveBeenCalled();
    expect(cacheIncrementWithTtl).toHaveBeenCalledOnce();
    expect(cacheDelete).not.toHaveBeenCalled();
  });

  it('rolls back and returns a service error if the matching recovery code has no player', async () => {
    const { pool } = createMockPool([{ recordset: [{ id: 50 }] }, { recordset: [] }]);
    vi.mocked(getPool).mockResolvedValue(pool);
    const ctx = context();

    const res = await handler(request(), ctx);

    expect(res.status).toBe(503);
    expect(res.jsonBody.message).toBe('Could not verify recovery code. Please try again.');
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).not.toHaveBeenCalled();
    expect(cacheIncrementWithTtl).not.toHaveBeenCalled();
    expect(ctx.error).toHaveBeenCalledWith(
      'Failed to verify player recovery code',
      expect.any(Error),
    );
  });
});
