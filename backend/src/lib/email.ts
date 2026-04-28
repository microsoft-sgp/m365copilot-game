import { EmailClient } from '@azure/communication-email';

type LoggerLike = {
  log?: (message: string) => void;
  error?: (message: string, error: unknown) => void;
};

type EmailSendResult = { ok: true; skipped?: boolean } | { ok: false; error: string };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown email send error';
}

export async function sendAdminOtpEmail(
  email: string,
  code: string,
  context: LoggerLike = console,
): Promise<EmailSendResult> {
  const connectionString = process.env.ACS_CONNECTION_STRING || process.env.SMTP_CONNECTION || '';
  const senderAddress = process.env.ACS_EMAIL_SENDER || process.env.ACS_SENDER_ADDRESS || '';

  if (!connectionString || !senderAddress) {
    if (process.env.NODE_ENV !== 'production') {
      context.log?.(`[DEV] Admin OTP for ${email}: ${code}`);
      return { ok: true, skipped: true };
    }
    return { ok: false, error: 'ACS Email is not configured' };
  }

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
      if (result?.status && result.status !== 'Succeeded') {
        return { ok: false, error: `ACS Email send ended with status ${result.status}` };
      }
    }

    return { ok: true };
  } catch (err) {
    context.error?.('Failed to send admin OTP email', err);
    return { ok: false, error: getErrorMessage(err) };
  }
}
