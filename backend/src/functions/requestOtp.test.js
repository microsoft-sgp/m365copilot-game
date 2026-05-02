import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPool, fakeRequest } from '../test-helpers/mockPool.js';

let mockPool;
vi.mock('../lib/db.js', () => ({
  getPool: () => mockPool.pool,
}));

const { beginSendMock, EmailClientMock } = vi.hoisted(() => ({
  beginSendMock: vi.fn(),
  EmailClientMock: vi.fn(function EmailClient() {
    return { beginSend: beginSendMock };
  }),
}));

vi.mock('@azure/communication-email', () => ({
  EmailClient: EmailClientMock,
}));

const { handler } = await import('./requestOtp.js');

function getSendAttemptCalls(context) {
  return context.log.mock.calls.filter(([event]) => event === 'admin_otp_send_attempt');
}

describe('POST /api/portal-api/request-otp', () => {
  let prevEmails, prevNodeEnv, prevConnection, prevSender, prevSmtpConnection, prevLegacySender;

  beforeEach(() => {
    prevEmails = process.env.ADMIN_EMAILS;
    prevNodeEnv = process.env.NODE_ENV;
    prevConnection = process.env.ACS_CONNECTION_STRING;
    prevSender = process.env.ACS_EMAIL_SENDER;
    prevSmtpConnection = process.env.SMTP_CONNECTION;
    prevLegacySender = process.env.ACS_SENDER_ADDRESS;
    process.env.ADMIN_EMAILS = 'admin@test.com,boss@test.com';
    delete process.env.ACS_CONNECTION_STRING;
    delete process.env.ACS_EMAIL_SENDER;
    delete process.env.SMTP_CONNECTION;
    delete process.env.ACS_SENDER_ADDRESS;
    beginSendMock.mockReset();
    EmailClientMock.mockClear();
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
    if (prevSmtpConnection === undefined) delete process.env.SMTP_CONNECTION;
    else process.env.SMTP_CONNECTION = prevSmtpConnection;
    if (prevLegacySender === undefined) delete process.env.ACS_SENDER_ADDRESS;
    else process.env.ACS_SENDER_ADDRESS = prevLegacySender;
  });

  it('returns 500 when ADMIN_EMAILS is not configured', async () => {
    delete process.env.ADMIN_EMAILS;
    mockPool = createMockPool([[]]);
    const ctx = { log: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.status).toBe(500);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1]).toEqual({ outcome: 'not_configured' });
  });

  it('returns success for non-admin email (prevents enumeration)', async () => {
    mockPool = createMockPool([[]]);
    const ctx = { log: vi.fn() };
    const req = fakeRequest({ body: { email: 'nobody@test.com' } });
    const res = await handler(req, ctx);
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls).toHaveLength(1);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('not_authorised');
    expect(events[0][1].email_hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('returns 400 for missing email', async () => {
    mockPool = createMockPool([[]]);
    const req = fakeRequest({ body: {} });
    const res = await handler(req, { log: vi.fn() });
    expect(res.status).toBe(400);
  });

  it('rate limits to 1 OTP per 60s', async () => {
    // Recent OTP within 60s
    mockPool = createMockPool([[], [{ created_at: new Date().toISOString() }]]);
    const ctx = { log: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.status).toBe(429);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('rate_limited');
    expect(events[0][1].email_hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('creates OTP when no recent request exists', async () => {
    // No recent OTP, then INSERT succeeds
    mockPool = createMockPool([
      [], // no db-backed admins
      [], // no recent OTP
      { recordset: [{ id: 10 }], rowsAffected: [1] }, // INSERT
    ]);
    const ctx = { log: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.jsonBody.ok).toBe(true);
    expect(mockPool.calls).toHaveLength(3);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('dev_skipped');
    expect(typeof events[0][1].latency_ms).toBe('number');
    expect(events[0][1].email_hash).toMatch(/^[0-9a-f]{12}$/);
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
    const ctx = { log: vi.fn(), error: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.status).toBe(503);
    expect(mockPool.calls[3].query).toContain('UPDATE admin_otps SET used = 1');
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('acs_failed');
    expect(events[0][1].acs_send_status).toBe('not_configured');
    expect(events[0][1].email_hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('invalidates OTP when ACS connection string is an unresolved Key Vault reference', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACS_CONNECTION_STRING =
      '@Microsoft.KeyVault(SecretUri=https://example.vault.azure.net/secrets/acs-connection-string/version)';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    mockPool = createMockPool([
      [],
      [],
      { recordset: [{ id: 13 }], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const ctx = { log: vi.fn(), error: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });

    const res = await handler(req, ctx);

    expect(res.status).toBe(503);
    expect(mockPool.calls[3].query).toContain('UPDATE admin_otps SET used = 1');
    expect(EmailClientMock).not.toHaveBeenCalled();
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('acs_failed');
    expect(events[0][1].acs_send_status).toBe('not_configured');
    expect(events[0][1].email_hash).toMatch(/^[0-9a-f]{12}$/);
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

  it('emits outcome=sent with acs_message_id and latency_ms when ACS succeeds', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Succeeded', id: 'op-abc' })),
    });
    mockPool = createMockPool([
      [],
      [],
      { recordset: [{ id: 21 }], rowsAffected: [1] },
    ]);
    const ctx = { log: vi.fn(), error: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.jsonBody.ok).toBe(true);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('sent');
    expect(events[0][1].acs_message_id).toBe('op-abc');
    expect(typeof events[0][1].latency_ms).toBe('number');
    expect(events[0][1].email_hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('emits outcome=acs_failed with non_succeeded_status when ACS terminal status is not Succeeded', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Failed', id: 'op-fail' })),
    });
    mockPool = createMockPool([
      [],
      [],
      { recordset: [{ id: 22 }], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const ctx = { log: vi.fn(), error: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.status).toBe(503);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('acs_failed');
    expect(events[0][1].acs_send_status).toBe('non_succeeded_status:Failed');
    expect(events[0][1].acs_message_id).toBe('op-fail');
  });

  it('emits outcome=acs_failed with exception status and error_name when ACS throws', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockRejectedValue(new TypeError('boom'));
    mockPool = createMockPool([
      [],
      [],
      { recordset: [{ id: 23 }], rowsAffected: [1] },
      { recordset: [], rowsAffected: [1] },
    ]);
    const ctx = { log: vi.fn(), error: vi.fn() };
    const req = fakeRequest({ body: { email: 'admin@test.com' } });
    const res = await handler(req, ctx);
    expect(res.status).toBe(503);
    const events = getSendAttemptCalls(ctx);
    expect(events).toHaveLength(1);
    expect(events[0][1].outcome).toBe('acs_failed');
    expect(events[0][1].acs_send_status).toBe('exception');
    expect(events[0][1].error_name).toBe('TypeError');
  });

  it('never emits the bare email address in any log field', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Succeeded', id: 'op-pii' })),
    });
    mockPool = createMockPool([
      [],
      [],
      { recordset: [{ id: 31 }], rowsAffected: [1] },
    ]);
    const ctx = { log: vi.fn(), error: vi.fn() };
    const email = 'admin@test.com';
    const req = fakeRequest({ body: { email } });
    await handler(req, ctx);
    const serialised = JSON.stringify(ctx.log.mock.calls);
    expect(serialised).not.toContain(email);
  });

  it('produces the same email_hash regardless of email casing', async () => {
    // Two non-admin lookups so we exercise the hashing branch twice without
    // side effects on the OTP table.
    mockPool = createMockPool([[], []]);
    const ctxA = { log: vi.fn() };
    const ctxB = { log: vi.fn() };
    await handler(fakeRequest({ body: { email: 'Foo@Example.com' } }), ctxA);
    // Reset pool for the second call so the unused-script guard does not fire.
    mockPool = createMockPool([[]]);
    await handler(fakeRequest({ body: { email: 'foo@example.com' } }), ctxB);
    const hashA = getSendAttemptCalls(ctxA)[0][1].email_hash;
    const hashB = getSendAttemptCalls(ctxB)[0][1].email_hash;
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{12}$/);
  });
});
