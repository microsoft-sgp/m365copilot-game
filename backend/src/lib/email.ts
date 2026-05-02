import { EmailClient } from '@azure/communication-email';

type LoggerLike = {
  log?: (message: string, details?: Record<string, unknown>) => void;
  error?: (message: string, error: unknown) => void;
};

export type EmailSendResult =
  | { ok: true; skipped?: boolean; messageId?: string; latencyMs: number }
  | {
      ok: false;
      error: string;
      status: 'exception' | 'non_succeeded' | 'not_configured';
      acsStatus?: string;
      messageId?: string;
      errorName?: string;
      latencyMs: number;
    };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown email send error';
}

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function readMessageId(poller: unknown, pollResult: unknown): string | undefined {
  // ACS LRO pollers expose the operation id in a couple of places depending on
  // the SDK version. Read defensively and treat absence as non-fatal.
  const fromResult = (pollResult as { id?: unknown } | null | undefined)?.id;
  if (typeof fromResult === 'string' && fromResult.length > 0) return fromResult;

  const stateGetter = (poller as { getOperationState?: () => unknown } | null | undefined)
    ?.getOperationState;
  if (typeof stateGetter === 'function') {
    try {
      const state = stateGetter.call(poller) as { result?: { id?: unknown } } | undefined;
      const fromState = state?.result?.id;
      if (typeof fromState === 'string' && fromState.length > 0) return fromState;
    } catch {
      // ignore — messageId is optional
    }
  }

  return undefined;
}

export async function sendAdminOtpEmail(
  email: string,
  code: string,
  context: LoggerLike = console,
): Promise<EmailSendResult> {
  const start = Date.now();
  const connectionString = process.env.ACS_CONNECTION_STRING || process.env.SMTP_CONNECTION || '';
  const senderAddress = process.env.ACS_EMAIL_SENDER || process.env.ACS_SENDER_ADDRESS || '';

  if (!connectionString || !senderAddress) {
    if (process.env.NODE_ENV !== 'production') {
      context.log?.(`[DEV] Admin OTP for ${email}: ${code}`);
      return { ok: true, skipped: true, latencyMs: Date.now() - start };
    }
    return {
      ok: false,
      error: 'ACS Email is not configured',
      status: 'not_configured',
      latencyMs: 0,
    };
  }

  let messageId: string | undefined;
  try {
    const client = new EmailClient(connectionString);
    const poller = await client.beginSend({
      senderAddress,
      content: {
        subject: 'Your Copilot Bingo admin verification code',
        plainText: `Your admin verification code is ${code}. It expires in 10 minutes.`,
      },
      recipients: {
        to: [{ address: email }],
      },
    });

    if (typeof poller.pollUntilDone === 'function') {
      const result = await poller.pollUntilDone();
      messageId = readMessageId(poller, result);
      if (result?.status && result.status !== 'Succeeded') {
        return {
          ok: false,
          error: `ACS Email send ended with status ${result.status}`,
          status: 'non_succeeded',
          acsStatus: result.status,
          messageId,
          latencyMs: Date.now() - start,
        };
      }
    } else {
      messageId = readMessageId(poller, undefined);
    }

    return { ok: true, messageId, latencyMs: Date.now() - start };
  } catch (err) {
    context.error?.('Failed to send admin OTP email', err);
    return {
      ok: false,
      error: getErrorMessage(err),
      status: 'exception',
      errorName: getErrorName(err),
      messageId,
      latencyMs: Date.now() - start,
    };
  }
}

export async function sendPlayerRecoveryEmail(
  email: string,
  code: string,
  context: LoggerLike = console,
): Promise<EmailSendResult> {
  const start = Date.now();
  const connectionString = process.env.ACS_CONNECTION_STRING || process.env.SMTP_CONNECTION || '';
  const senderAddress = process.env.ACS_EMAIL_SENDER || process.env.ACS_SENDER_ADDRESS || '';

  if (!connectionString || !senderAddress) {
    if (process.env.NODE_ENV !== 'production') {
      return { ok: true, skipped: true, latencyMs: Date.now() - start };
    }
    return {
      ok: false,
      error: 'ACS Email is not configured',
      status: 'not_configured',
      latencyMs: 0,
    };
  }

  let messageId: string | undefined;
  try {
    const client = new EmailClient(connectionString);
    const poller = await client.beginSend({
      senderAddress,
      content: {
        subject: 'Your Copilot Bingo player recovery code',
        plainText: `Your player recovery code is ${code}. It expires in 10 minutes.`,
      },
      recipients: {
        to: [{ address: email }],
      },
    });

    if (typeof poller.pollUntilDone === 'function') {
      const result = await poller.pollUntilDone();
      messageId = readMessageId(poller, result);
      if (result?.status && result.status !== 'Succeeded') {
        return {
          ok: false,
          error: `ACS Email send ended with status ${result.status}`,
          status: 'non_succeeded',
          acsStatus: result.status,
          messageId,
          latencyMs: Date.now() - start,
        };
      }
    } else {
      messageId = readMessageId(poller, undefined);
    }

    return { ok: true, messageId, latencyMs: Date.now() - start };
  } catch (err) {
    context.error?.('Failed to send player recovery email', err);
    return {
      ok: false,
      error: getErrorMessage(err),
      status: 'exception',
      errorName: getErrorName(err),
      messageId,
      latencyMs: Date.now() - start,
    };
  }
}
