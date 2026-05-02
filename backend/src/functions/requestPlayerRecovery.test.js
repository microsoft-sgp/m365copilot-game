import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

vi.mock('../lib/db.js', () => ({ getPool: vi.fn() }));
vi.mock('../lib/email.js', () => ({ sendPlayerRecoveryEmail: vi.fn() }));

import { getPool } from '../lib/db.js';
import { sendPlayerRecoveryEmail } from '../lib/email.js';
import { handler } from './requestPlayerRecovery.js';

function context() {
  return { log: vi.fn(), error: vi.fn() };
}

function request(email) {
  return fakeRequest({ body: { email } });
}

describe('requestPlayerRecovery', () => {
  beforeEach(() => {
    vi.mocked(getPool).mockReset();
    vi.mocked(sendPlayerRecoveryEmail).mockReset();
    vi.mocked(sendPlayerRecoveryEmail).mockResolvedValue({ ok: true, latencyMs: 12 });
  });

  it('sends a code for an existing claimed player and logs without raw email', async () => {
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11, owner_token: 'hash' }] },
      { recordset: [] },
      { recordset: [{ id: 30 }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);
    const ctx = context();

    const res = await handler(request('Ada@Example.com'), ctx);

    expect(res.jsonBody.ok).toBe(true);
    expect(sendPlayerRecoveryEmail).toHaveBeenCalledWith(
      'ada@example.com',
      expect.stringMatching(/^\d{6}$/),
      ctx,
    );
    expect(calls[2].query).toMatch(/INSERT INTO player_recovery_otps/);
    expect(calls[2].inputs.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ctx.log.mock.calls)).not.toContain('ada@example.com');
  });

  it('returns the same neutral success for an unknown email and sends nothing', async () => {
    const { pool } = createMockPool([{ recordset: [] }]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request('unknown@example.com'), context());

    expect(res.jsonBody).toEqual({
      ok: true,
      message: 'If this email is registered, a recovery code has been sent.',
    });
    expect(sendPlayerRecoveryEmail).not.toHaveBeenCalled();
  });

  it('rejects invalid email shape', async () => {
    const res = await handler(request('not-an-email'), context());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ ok: false, message: 'Valid email is required' });
    expect(getPool).not.toHaveBeenCalled();
  });

  it('rate limits repeated requests for a known player', async () => {
    const { pool } = createMockPool([
      { recordset: [{ id: 11, owner_token: 'hash' }] },
      { recordset: [{ created_at: new Date() }] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request('ada@example.com'), context());

    expect(res.status).toBe(429);
    expect(res.jsonBody).toEqual({
      ok: false,
      message: 'Please wait before requesting another code',
    });
    expect(sendPlayerRecoveryEmail).not.toHaveBeenCalled();
  });

  it('marks the code used and returns 503 when email send fails for a known player', async () => {
    vi.mocked(sendPlayerRecoveryEmail).mockResolvedValueOnce({
      ok: false,
      status: 'exception',
      error: 'send failed',
      latencyMs: 4,
      errorName: 'BoomError',
    });
    const { pool, calls } = createMockPool([
      { recordset: [{ id: 11, owner_token: 'hash' }] },
      { recordset: [] },
      { recordset: [{ id: 30 }] },
      { recordset: [], rowsAffected: [1] },
    ]);
    vi.mocked(getPool).mockResolvedValue(pool);

    const res = await handler(request('ada@example.com'), context());

    expect(res.status).toBe(503);
    expect(res.jsonBody.message).toContain('Could not send recovery code');
    expect(calls[3].query).toMatch(/UPDATE player_recovery_otps SET used = 1/);
  });
});