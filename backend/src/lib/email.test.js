import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { beginSendMock, EmailClientMock } = vi.hoisted(() => ({
  beginSendMock: vi.fn(),
  EmailClientMock: vi.fn(function EmailClient() {
    return { beginSend: beginSendMock };
  }),
}));
const captureOperationalErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@azure/communication-email', () => ({
  EmailClient: EmailClientMock,
}));

vi.mock('./sentry.js', () => ({
  captureOperationalError: captureOperationalErrorMock,
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
    captureOperationalErrorMock.mockClear();
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
    const sentMessage = beginSendMock.mock.calls[0][0];
    expect(EmailClientMock).toHaveBeenCalledWith(process.env.ACS_CONNECTION_STRING);
    expect(sentMessage.senderAddress).toBe('DoNotReply@example.com');
    expect(sentMessage.recipients.to[0].address).toBe('admin@test.com');
    expect(sentMessage.content.subject).toBe('Your Copilot Bingo verification code');
    expect(sentMessage.content.plainText).toContain('Welcome to Copilot Bingo!');
    expect(sentMessage.content.plainText).toContain('Your verification code is: 123456');
    expect(sentMessage.content.plainText).toContain('This code expires in 10 minutes.');
    expect(sentMessage.content.html).toContain('Welcome to Copilot Bingo!');
    expect(sentMessage.content.html).toContain('Your verification code is:');
    expect(sentMessage.content.html).toContain('1 2 3 4 5 6');
    expect(sentMessage.content.html).toContain('This code expires in 10 minutes.');
    expect(sentMessage.content.html).toContain('DEVGRU Team');
    const emailBody = `${sentMessage.content.plainText}\n${sentMessage.content.html}`;
    expect(emailBody).not.toContain('endpoint=https://example.communication.azure.com/');
    expect(emailBody).not.toContain('accesskey=test');
    expect(emailBody).not.toMatch(/jwt/i);
    expect(emailBody).not.toMatch(/hash/i);
    expect(emailBody).not.toMatch(/telemetry/i);
    expect(emailBody).not.toMatch(/request ip/i);
    expect(emailBody).not.toMatch(/203\.127\.164\.118/);
    expect(emailBody).not.toMatch(/https?:\/\//i);
    expect(emailBody).not.toMatch(/request a new/i);
  });

  it('sends branded player recovery email content through ACS Email when configured', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Succeeded', id: 'op-player' })),
    });

    const result = await sendPlayerRecoveryEmail('player@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(true);
    const sentMessage = beginSendMock.mock.calls[0][0];
    expect(sentMessage.senderAddress).toBe('DoNotReply@example.com');
    expect(sentMessage.recipients.to[0].address).toBe('player@test.com');
    expect(sentMessage.content.subject).toBe('Your Copilot Bingo player recovery code');
    expect(sentMessage.content.plainText).toContain('Welcome to Copilot Bingo!');
    expect(sentMessage.content.plainText).toContain('Your player recovery code is: 123456');
    expect(sentMessage.content.plainText).toContain('This code expires in 10 minutes.');
    expect(sentMessage.content.html).toContain('Welcome to Copilot Bingo!');
    expect(sentMessage.content.html).toContain('Your player recovery code is:');
    expect(sentMessage.content.html).toContain('1 2 3 4 5 6');
    expect(sentMessage.content.html).toContain('This code expires in 10 minutes.');
    expect(sentMessage.content.html).toContain('DEVGRU Team');
    const emailBody = `${sentMessage.content.plainText}\n${sentMessage.content.html}`;
    expect(emailBody).not.toContain('endpoint=https://example.communication.azure.com/');
    expect(emailBody).not.toContain('accesskey=test');
    expect(emailBody).not.toMatch(/jwt/i);
    expect(emailBody).not.toMatch(/hash/i);
    expect(emailBody).not.toMatch(/token/i);
    expect(emailBody).not.toMatch(/telemetry/i);
    expect(emailBody).not.toMatch(/request ip/i);
    expect(emailBody).not.toMatch(/203\.127\.164\.118/);
    expect(emailBody).not.toMatch(/https?:\/\//i);
  });

  it('reads player recovery message id from poller state when poll result has no id', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Succeeded' })),
      getOperationState: vi.fn(() => ({ result: { id: 'state-message-id' } })),
    });

    const result = await sendPlayerRecoveryEmail('player@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('state-message-id');
  });

  it('treats pollers without pollUntilDone as sent and reads optional state message id', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      getOperationState: vi.fn(() => ({ result: { id: 'fire-and-forget-id' } })),
    });

    const result = await sendAdminOtpEmail('admin@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('fire-and-forget-id');
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
    expect(captureOperationalErrorMock).toHaveBeenCalledWith('email_send_failure', {
      flow: 'admin-otp',
      status: 'non_succeeded',
      acsStatus: 'Failed',
      errorName: undefined,
      latencyMs: result.latencyMs,
      messageId: undefined,
      recipientDomain: 'test.com',
    });
    const capturedDetails = JSON.stringify(captureOperationalErrorMock.mock.calls[0]);
    expect(capturedDetails).not.toContain('123456');
    expect(capturedDetails).not.toContain('admin@test.com');
    expect(capturedDetails).not.toContain('accesskey=test');
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
    expect(captureOperationalErrorMock).toHaveBeenCalledWith(
      'email_send_failure',
      expect.objectContaining({
        flow: 'admin-otp',
        status: 'exception',
        errorName: 'TypeError',
        recipientDomain: 'test.com',
      }),
    );
  });

  it('reports player recovery provider failure with operation id and without leaking the recipient', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Failed' })),
      getOperationState: vi.fn(() => ({ result: { id: 'failed-player-message' } })),
    });

    const result = await sendPlayerRecoveryEmail('player@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('non_succeeded');
    expect(result.messageId).toBe('failed-player-message');
    expect(captureOperationalErrorMock).toHaveBeenCalledWith('email_send_failure', {
      flow: 'player-recovery',
      status: 'non_succeeded',
      acsStatus: 'Failed',
      errorName: undefined,
      latencyMs: result.latencyMs,
      messageId: 'failed-player-message',
      recipientDomain: 'test.com',
    });
    const capturedDetails = JSON.stringify(captureOperationalErrorMock.mock.calls[0]);
    expect(capturedDetails).not.toContain('player@test.com');
    expect(capturedDetails).not.toContain('123456');
  });

  it('reports player recovery exceptions through the recovery flow', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockRejectedValue(new RangeError('provider unavailable'));
    const context = { log: vi.fn(), error: vi.fn() };

    const result = await sendPlayerRecoveryEmail('player@test.com', '123456', context);

    expect(result.ok).toBe(false);
    expect(result.status).toBe('exception');
    expect(result.errorName).toBe('RangeError');
    expect(context.error).toHaveBeenCalledWith(
      'Failed to send player recovery email',
      expect.any(RangeError),
    );
    expect(captureOperationalErrorMock).toHaveBeenCalledWith(
      'email_send_failure',
      expect.objectContaining({
        flow: 'player-recovery',
        status: 'exception',
        errorName: 'RangeError',
        recipientDomain: 'test.com',
      }),
    );
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
    expect(captureOperationalErrorMock).toHaveBeenCalledWith(
      'email_send_failure',
      expect.objectContaining({
        flow: 'admin-otp',
        status: 'not_configured',
        recipientDomain: 'test.com',
      }),
    );
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
    expect(captureOperationalErrorMock).toHaveBeenCalledWith(
      'email_send_failure',
      expect.objectContaining({ status: 'not_configured', recipientDomain: 'test.com' }),
    );
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
    expect(captureOperationalErrorMock).toHaveBeenCalledWith(
      'email_send_failure',
      expect.objectContaining({
        flow: 'player-recovery',
        status: 'not_configured',
        recipientDomain: 'test.com',
      }),
    );
  });

  it('allows local development without ACS configuration', async () => {
    process.env.NODE_ENV = 'test';
    const context = { log: vi.fn(), error: vi.fn() };
    const result = await sendAdminOtpEmail('admin@test.com', '123456', context);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(typeof result.latencyMs).toBe('number');
    expect(context.log).toHaveBeenCalled();
    expect(captureOperationalErrorMock).not.toHaveBeenCalled();
  });
});
