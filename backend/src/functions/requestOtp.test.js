import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));

const { handler } = await import('./requestOtp.js');

describe('POST /api/admin/request-otp', () => {
  let prevEmails;

  beforeEach(() => {
    prevEmails = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'admin@test.com,boss@test.com';
  });

  afterEach(() => {
    if (prevEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prevEmails;
  });

  it('returns 500 when ADMIN_EMAILS is not configured', async () => {
    delete process.env.ADMIN_EMAILS;
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(500);
  });

  it('returns success for non-admin email (prevents enumeration)', async () => {
    mockPool = createMockPool([]);
    const req = fakeRequest({ body: { email: 'nobody@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
    // Should not have called pool.request() at all
    expect(mockPool.pool.request).not.toHaveBeenCalled();
  });

  it('returns 400 for missing email', async () => {
    const req = fakeRequest({ body: {} });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(400);
  });

  it('rate limits to 1 OTP per 60s', async () => {
    // Recent OTP within 60s
    mockPool = createMockPool([
      [{ created_at: new Date().toISOString() }],
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(429);
  });

  it('creates OTP when no recent request exists', async () => {
    // No recent OTP, then INSERT succeeds
    mockPool = createMockPool([
      [],          // no recent OTP
      { recordset: [], rowsAffected: [1] }, // INSERT
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls).toHaveLength(2);
  });
});
