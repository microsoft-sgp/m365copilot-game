import { EmailClient } from '@azure/communication-email';
import { captureOperationalError } from './sentry.js';

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

type EmailContent = {
  subject: string;
  plainText: string;
  html: string;
};

const ADMIN_OTP_SUBJECT = 'Your Copilot Bingo verification code';

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}

function renderAdminOtpEmail(code: string): EmailContent {
  const safeCode = escapeHtml(code);
  const displayCode = safeCode.split('').join(' ');

  return {
    subject: ADMIN_OTP_SUBJECT,
    plainText: [
      'Welcome to Copilot Bingo!',
      '',
      `Your verification code is: ${code}`,
      '',
      'This code expires in 10 minutes.',
      '',
      'If you did not request this code, you can safely ignore this email - no one can access your account without it.',
      '',
      'Thanks,',
      'DEVGRU Team',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#202124;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dde1e6;border-radius:8px;">
            <tr>
              <td style="padding:40px 44px 36px 44px;">
                <h1 style="margin:0 0 28px 0;font-size:26px;line-height:32px;font-weight:700;color:#202124;">Welcome to Copilot Bingo!</h1>
                <p style="margin:0 0 14px 0;font-size:18px;line-height:28px;color:#4b4f5c;">Your verification code is:</p>
                <div style="margin:0 0 30px 0;padding:26px 16px;border-radius:8px;background:#f1f1f3;text-align:center;font-size:36px;line-height:44px;font-weight:700;letter-spacing:10px;color:#202124;" aria-label="Verification code">${displayCode}</div>
                <p style="margin:0 0 24px 0;font-size:18px;line-height:28px;color:#5f6470;">This code expires in 10 minutes.</p>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#6b7280;">If you did not request this code, you can safely ignore this email - no one can access your account without it.</p>
                <div style="height:1px;background:#e5e7eb;margin:30px 0 28px 0;line-height:1px;">&nbsp;</div>
                <p style="margin:0;font-size:16px;line-height:26px;color:#9ca3af;">Thanks,<br>DEVGRU Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown email send error';
}

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function configuredValue(primary: string | undefined, fallback: string | undefined): string {
  const primaryValue = primary?.trim() ?? '';
  if (primaryValue) return primaryValue;
  return fallback?.trim() ?? '';
}

function isUnresolvedKeyVaultReference(value: string): boolean {
  return value.trim().startsWith('@Microsoft.KeyVault(');
}

function notConfiguredResult(): EmailSendResult {
  return {
    ok: false,
    error: 'ACS Email is not configured',
    status: 'not_configured',
    latencyMs: 0,
  };
}

function recipientDomain(email: string): string | undefined {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : undefined;
}

async function captureEmailFailure(
  flow: 'admin-otp' | 'player-recovery',
  email: string,
  result: EmailSendResult,
): Promise<void> {
  if (result.ok) return;
  await captureOperationalError('email_send_failure', {
    flow,
    status: result.status,
    acsStatus: result.acsStatus,
    errorName: result.errorName,
    latencyMs: result.latencyMs,
    messageId: result.messageId,
    recipientDomain: recipientDomain(email),
  });
}

type EmailConfigResult =
  | { ok: true; connectionString: string; senderAddress: string }
  | { ok: false; reason: 'missing' | 'unresolved_reference' };

function readEmailConfig(): EmailConfigResult {
  const connectionString = configuredValue(
    process.env.ACS_CONNECTION_STRING,
    process.env.SMTP_CONNECTION,
  );
  const senderAddress = configuredValue(
    process.env.ACS_EMAIL_SENDER,
    process.env.ACS_SENDER_ADDRESS,
  );

  if (!connectionString || !senderAddress) return { ok: false, reason: 'missing' };
  if (
    isUnresolvedKeyVaultReference(connectionString) ||
    isUnresolvedKeyVaultReference(senderAddress)
  ) {
    return { ok: false, reason: 'unresolved_reference' };
  }

  return { ok: true, connectionString, senderAddress };
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
  const emailConfig = readEmailConfig();

  if (!emailConfig.ok) {
    if (emailConfig.reason === 'missing' && process.env.NODE_ENV !== 'production') {
      context.log?.(`[DEV] Admin OTP for ${email}: ${code}`);
      return { ok: true, skipped: true, latencyMs: Date.now() - start };
    }
    const result = notConfiguredResult();
    await captureEmailFailure('admin-otp', email, result);
    return result;
  }

  let messageId: string | undefined;
  try {
    const client = new EmailClient(emailConfig.connectionString);
    const content = renderAdminOtpEmail(code);
    const poller = await client.beginSend({
      senderAddress: emailConfig.senderAddress,
      content,
      recipients: {
        to: [{ address: email }],
      },
    });

    if (typeof poller.pollUntilDone === 'function') {
      const pollResult = await poller.pollUntilDone();
      messageId = readMessageId(poller, pollResult);
      if (pollResult?.status && pollResult.status !== 'Succeeded') {
        const result: EmailSendResult = {
          ok: false,
          error: `ACS Email send ended with status ${pollResult.status}`,
          status: 'non_succeeded',
          acsStatus: pollResult.status,
          messageId,
          latencyMs: Date.now() - start,
        };
        await captureEmailFailure('admin-otp', email, result);
        return result;
      }
    } else {
      messageId = readMessageId(poller, undefined);
    }

    return { ok: true, messageId, latencyMs: Date.now() - start };
  } catch (err) {
    context.error?.('Failed to send admin OTP email', err);
    const result: EmailSendResult = {
      ok: false,
      error: getErrorMessage(err),
      status: 'exception',
      errorName: getErrorName(err),
      messageId,
      latencyMs: Date.now() - start,
    };
    await captureEmailFailure('admin-otp', email, result);
    return result;
  }
}

export async function sendPlayerRecoveryEmail(
  email: string,
  code: string,
  context: LoggerLike = console,
): Promise<EmailSendResult> {
  const start = Date.now();
  const emailConfig = readEmailConfig();

  if (!emailConfig.ok) {
    if (emailConfig.reason === 'missing' && process.env.NODE_ENV !== 'production') {
      return { ok: true, skipped: true, latencyMs: Date.now() - start };
    }
    const result = notConfiguredResult();
    await captureEmailFailure('player-recovery', email, result);
    return result;
  }

  let messageId: string | undefined;
  try {
    const client = new EmailClient(emailConfig.connectionString);
    const poller = await client.beginSend({
      senderAddress: emailConfig.senderAddress,
      content: {
        subject: 'Your Copilot Bingo player recovery code',
        plainText: `Your player recovery code is ${code}. It expires in 10 minutes.`,
      },
      recipients: {
        to: [{ address: email }],
      },
    });

    if (typeof poller.pollUntilDone === 'function') {
      const pollResult = await poller.pollUntilDone();
      messageId = readMessageId(poller, pollResult);
      if (pollResult?.status && pollResult.status !== 'Succeeded') {
        const result: EmailSendResult = {
          ok: false,
          error: `ACS Email send ended with status ${pollResult.status}`,
          status: 'non_succeeded',
          acsStatus: pollResult.status,
          messageId,
          latencyMs: Date.now() - start,
        };
        await captureEmailFailure('player-recovery', email, result);
        return result;
      }
    } else {
      messageId = readMessageId(poller, undefined);
    }

    return { ok: true, messageId, latencyMs: Date.now() - start };
  } catch (err) {
    context.error?.('Failed to send player recovery email', err);
    const result: EmailSendResult = {
      ok: false,
      error: getErrorMessage(err),
      status: 'exception',
      errorName: getErrorName(err),
      messageId,
      latencyMs: Date.now() - start,
    };
    await captureEmailFailure('player-recovery', email, result);
    return result;
  }
}
