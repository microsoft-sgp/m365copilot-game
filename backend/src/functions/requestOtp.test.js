import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));

const { handler } = await import('./requestOtp.js');

describe('POST /api/portal-api/request-otp', () => {
  let prevEmails, prevNodeEnv, prevConnection, prevSender;

  beforeEach(() => {
    prevEmails = process.env.ADMIN_EMAILS;
    prevNodeEnv = process.env.NODE_ENV;
    prevConnection = process.env.ACS_CONNECTION_STRING;
    prevSender = process.env.ACS_EMAIL_SENDER;
    process.env.ADMIN_EMAILS = 'admin@test.com,boss@test.com';
    delete process.env.ACS_CONNECTION_STRING;
    delete process.env.ACS_EMAIL_SENDER;
  });

  afterEach(() => {
    if (prevEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prevEmails;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevConnection === undefined) delete process.env.ACS_CONNECTION_STRING;
    else process.env.ACS_CONNECTION_STRING = prevConnection;
    if (prevSender === undefined) delete process.env.ACS_EMAIL_SENDER;
    else process.env.ACS_EMAIL_SENDER = prevSender;
  });

  it('returns 500 when ADMIN_EMAILS is not configured', async () => {
    delete process.env.ADMIN_EMAILS;
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(500);
  });

  it('returns success for non-admin email (prevents enumeration)', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ body: { email: 'nobody@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls).toHaveLength(1);
  });

  it('returns 400 for missing email', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ body: {} });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(400);
  });

  it('rate limits to 1 OTP per 60s', async () => {
    // Recent OTP within 60s
    mockPool = createMockPool([
      [],
      [{ created_at: new Date().toISOString() }],
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(429);
  });

  it('creates OTP when no recent request exists', async () => {
    // No recent OTP, then INSERT succeeds
    mockPool = createMockPool([
      [],          // no db-backed admins
      [],          // no recent OTP
      { recordset: [{ id: 10 }], rowsAffected: [1] }, // INSERT
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls).toHaveLength(3);
  });

  it('uses database-backed admin emails', async () => {
    process.env.ADMIN_EMAILS = '';
    mockPool = createMockPool([
      [{ email: 'dbadmin@test.com' }],
      [],
      { recordset: [{ id: 11 }], rowsAffected: [1] },
    ]);
    const req = fakeRequest({ body: { email: 'dbadmin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
  });

  it('invalidates OTP when ACS Email send fails in production', async () => {
    process.env.NODE_ENV = 'production';
    mockPool = createMockPool([
      [],
      [],
      { recordset: [{ id: 12 }], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn(), error: vi.fn() });
    expect(res.status).toBe(503);
    expect(mockPool.calls[3].query).toContain('UPDATE admin_otps SET used = 1');
  });

  it('returns 400 when email lacks an @ sign', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ body: { email: 'not-an-email' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(400);
  });

  it('allows a second OTP after the rate-limit window passes', async () => {
    const longAgo = new Date(Date.now() - 120_000).toISOString();
    mockPool = createMockPool([
      [],
      [{ created_at: longAgo }],
      { recordset: [{ id: 99 }], rowsAffected: [1] },
    ]);
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, { log: vi.fn() });
    expect(res.jsonBody.ok).toBe(true);
  });
});
