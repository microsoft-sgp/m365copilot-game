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

const { sendAdminOtpEmail } = await import('./email.js');

describe('sendAdminOtpEmail', () => {
  let prevConnection, prevSender, prevNodeEnv;

  beforeEach(() => {
    prevConnection = process.env.ACS_CONNECTION_STRING;
    prevSender = process.env.ACS_EMAIL_SENDER;
    prevNodeEnv = process.env.NODE_ENV;
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
  });

  it('sends through ACS Email when configured', async () => {
    process.env.ACS_CONNECTION_STRING =
      'endpoint=https://example.communication.azure.com/;accesskey=test';
    process.env.ACS_EMAIL_SENDER = 'DoNotReply@example.com';
    beginSendMock.mockResolvedValue({
      pollUntilDone: vi.fn(async () => ({ status: 'Succeeded' })),
    });

    const result = await sendAdminOtpEmail('admin@test.com', '123456', {
      log: vi.fn(),
      error: vi.fn(),
    });

    expect(result.ok).toBe(true);
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
  });

  it('allows local development without ACS configuration', async () => {
    process.env.NODE_ENV = 'test';
    const context = { log: vi.fn(), error: vi.fn() };
    const result = await sendAdminOtpEmail('admin@test.com', '123456', context);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(context.log).toHaveBeenCalled();
  });
});
