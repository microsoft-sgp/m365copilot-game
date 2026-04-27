import { EmailClient } from '@azure/communication-email';

export async function sendAdminOtpEmail(email, code, context = console) {
  const connectionString = process.env.ACS_CONNECTION_STRING || process.env.SMTP_CONNECTION || '';
  const senderAddress = process.env.ACS_EMAIL_SENDER || process.env.ACS_SENDER_ADDRESS || '';

  if (!connectionString || !senderAddress) {
    if (process.env.NODE_ENV !== 'production') {
      context.log?.('[DEV] ACS Email not configured — OTP not sent (check server logs for manual testing)');
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
    return { ok: false, error: err.message };
  }
}