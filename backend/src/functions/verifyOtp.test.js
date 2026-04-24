import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';
import { hashOtp } from '../lib/adminAuth.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));

const { handler } = await import('./verifyOtp.js');

describe('POST /api/admin/verify-otp', () => {
  let prevEmails, prevSecret;

  beforeEach(() => {
    prevEmails = process.env.ADMIN_EMAILS;
    prevSecret = process.env.JWT_SECRET;
    process.env.ADMIN_EMAILS = 'admin@test.com';
    process.env.JWT_SECRET = 'test-jwt-secret-key';
  });

  afterEach(() => {
    if (prevEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prevEmails;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });

  it('returns 400 for missing fields', async () => {
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(400);
  });

  it('returns 401 for non-admin email', async () => {
    const req = fakeRequest({ body: { email: 'nobody@test.com', code: '123456' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid code', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ body: { email: 'admin@test.com', code: '000000' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(401);
    expect(res.jsonBody.message).toBe('Invalid code');
  });

  it('returns 401 for already-used OTP', async () => {
    mockPool = createMockPool([
      [{ id: 1, expires_at: new Date(Date.now() + 60000).toISOString(), used: true }],
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com', code: '123456' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(401);
    expect(res.jsonBody.message).toMatch(/already used/i);
  });

  it('returns 401 for expired OTP', async () => {
    mockPool = createMockPool([
      [{ id: 1, expires_at: new Date(Date.now() - 60000).toISOString(), used: false }],
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com', code: '123456' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(401);
    expect(res.jsonBody.message).toMatch(/expired/i);
  });

  it('returns JWT for valid OTP', async () => {
    mockPool = createMockPool([
      [{ id: 1, expires_at: new Date(Date.now() + 300000).toISOString(), used: false }],
      { recordset: [], rowsAffected: [1] }, // UPDATE used = 1
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com', code: '123456' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
    expect(res.jsonBody.token).toBeDefined();
    expect(res.jsonBody.token.split('.')).toHaveLength(3);
  });
});
