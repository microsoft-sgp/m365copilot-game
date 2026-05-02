import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { beginSendMock, EmailClientMock } = vi.hoisted(() => ({
  beginSendMock: vi.fn(),
  EmailClientMock: vi.fn(function EmailClient() {
    return { beginSend: beginSendMock };
  }),
}));

vi.mock('@azure/communication-email', () => ({
  EmailClient: EmailClientMock,
}));

const { sendAdminOtpEmail, sendPlayerRecoveryEmail } = await import('./email.js');

describe('sendAdminOtpEmail', () => {
  let prevConnection, prevSender, prevNodeEnv, prevSmtpConnection, prevLegacySender;

  beforeEach(() => {
    prevConnection = process.env.ACS_CONNECTION_STRING;
    prevSender = process.env.ACS_EMAIL_SENDER;
    prevNodeEnv = process.env.NODE_ENV;
    prevSmtpConnection = process.env.SMTP_CONNECTION;
    prevLegacySender = process.env.ACS_SENDER_ADDRESS;
    delete process.env.ACS_CONNECTION_STRING;
    delete process.env.ACS_EMAIL_SENDER;
    delete process.env.SMTP_CONNECTION;
    delete process.env.ACS_SENDER_ADDRESS;
    beginSendMock.mockReset();
    EmailClientMock.mockClear();
  });

  afterEach(() => {
    if (prevConnection === undefined) delete process.env.ACS_CONNECTION_STRING;
    else process.env.ACS_CONNECTION_STRING = prevConnection;
    if (prevSender === undefined) delete process.env.ACS_EMAIL_SENDER;
    else process.env.ACS_EMAIL_SENDER = prevSender;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevSmtpConnection === undefined) delete process.env.SMTP_CONNECTION;
    else process.env.SMTP_CONNECTION = prevSmtpConnection;
    if (prevLegacySender === undefined) delete process.env.ACS_SENDER_ADDRESS;
    else process.env.ACS_SENDER_ADDRESS = prevLegacySender;
  });

  it('sends through ACS Email when configured', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Succeeded', id: 'op-123' })),
    });

    const result = await sendAdminOtpEmail('admin@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(result.messageId).toBe('op-123');
    expect(EmailClientMock).toHaveBeenCalledWith(process.env.ACS_CONNECTION_STRING);
    expect(beginSendMock.mock.calls[0][0].senderAddress).toBe('DoNotReply@example.com');
    expect(beginSendMock.mock.calls[0][0].recipients.to[0].address).toBe('admin@test.com');
  });

  it('reports provider failure', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({ pollUntilDone: vi.fn(async () => ({ status: 'Failed' })) });

    const result = await sendAdminOtpEmail('admin@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Failed/);
    expect(result.status).toBe('non_succeeded');
    expect(result.acsStatus).toBe('Failed');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('reports thrown exception with status and latency', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockRejectedValue(new TypeError('boom'));

    const result = await sendAdminOtpEmail('admin@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('exception');
    expect(result.errorName).toBe('TypeError');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('reports not_configured in production with latencyMs 0', async () => {
    process.env.NODE_ENV = 'production';
    const result = await sendAdminOtpEmail('admin@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('not_configured');
    expect(result.error).toBe('ACS Email is not configured');
    expect(result.latencyMs).toBe(0);
  });

  it('reports not_configured without constructing ACS client when connection string is unresolved', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ACS_CONNECTION_STRING =
      '@Microsoft.KeyVault(SecretUri=https://example.vault.azure.net/secrets/acs-connection-string/version)';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    const context = { log: vi.fn(), error: vi.fn() };

    const result = await sendAdminOtpEmail('admin@test.com', '123456', context);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('not_configured');
    expect(result.error).toBe('ACS Email is not configured');
    expect(result.latencyMs).toBe(0);
    expect(EmailClientMock).not.toHaveBeenCalled();
    expect(beginSendMock).not.toHaveBeenCalled();
    expect(context.log).not.toHaveBeenCalled();
    expect(context.error).not.toHaveBeenCalled();
  });

  it('reports not_configured without constructing ACS client when sender is unresolved', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER =
      '@Microsoft.KeyVault(SecretUri=https://example.vault.azure.net/secrets/acs-email-sender/version)';

    const result = await sendPlayerRecoveryEmail('player@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('not_configured');
    expect(result.error).toBe('ACS Email is not configured');
    expect(result.latencyMs).toBe(0);
    expect(EmailClientMock).not.toHaveBeenCalled();
    expect(beginSendMock).not.toHaveBeenCalled();
  });

  it('allows local development without ACS configuration', async () => {
    process.env.NODE_ENV = 'test';
    const context = { log: vi.fn(), error: vi.fn() };
    const result = await sendAdminOtpEmail('admin@test.com', '123456', context);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(context.log).toHaveBeenCalled();
  });
});
