import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { createHash, randomInt } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { hashOtp, getEffectiveAdminEmails, normalizeEmail } from '../lib/adminAuth.js';
import { sendAdminOtpEmail } from '../lib/email.js';
import { readJsonObject, stringValue } from './http.js';

type SendAttemptOutcome =
  | 'sent'
  | 'dev_skipped'
  | 'acs_failed'
  | 'rate_limited'
  | 'not_authorised'
  | 'not_configured';

type SendAttemptDetails = {
  outcome: SendAttemptOutcome;
  email_hash?: string;
  latency_ms?: number;
  acs_message_id?: string;
  acs_send_status?: string;
  error_name?: string;
};

// Compute a non-reversible 12-char SHA-256 prefix of the normalized email so
// multiple OTP attempts by the same admin can be correlated in logs without
// exposing the address itself. Kept local to this file to avoid coupling the
// observability format to adminAuth.ts.
function emailHash(normalizedEmail: string): string {
  return createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12);
}

// Emit the single structured event used to triage the OTP send pipeline. The
// `not_configured` early-return intentionally omits `email_hash` because the
// request body has not yet been validated at that point; every other branch
// MUST include `email_hash`.
function logSendAttempt(context: InvocationContext, details: SendAttemptDetails): void {
  if (typeof context.log !== 'function') return;
  context.log('admin_otp_send_attempt', details);
}

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const pool = await getPool();
  const adminEmails = await getEffectiveAdminEmails(pool);
  if (adminEmails.length === 0) {
    logSendAttempt(context, { outcome: 'not_configured' });
    return {
      status: 500,
      jsonBody: { ok: false, message: 'Admin access not configured' },
    };
  }

  const body = await readJsonObject(request);
  const email = normalizeEmail(stringValue(body.email));

  if (!email || !email.includes('@')) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Valid email is required' },
    };
  }

  const hashedEmail = emailHash(email);

  // Always return same response to prevent email enumeration
  const successResponse = {
    jsonBody: { ok: true, message: 'If this email is authorised, a code has been sent.' },
  };

  if (!adminEmails.includes(email)) {
    logSendAttempt(context, { outcome: 'not_authorised', email_hash: hashedEmail });
    return successResponse;
  }

  // Rate limit: 1 OTP per 60 seconds per email
  const recent = await pool.request().input('email', sql.NVarChar(320), email).query(`
      SELECT TOP 1 created_at FROM admin_otps
      WHERE email = @email
      ORDER BY created_at DESC;
    `);

  if (recent.recordset.length > 0) {
    const lastCreated = new Date(recent.recordset[0].created_at);
    const elapsed = Date.now() - lastCreated.getTime();
    if (elapsed < 60_000) {
      logSendAttempt(context, { outcome: 'rate_limited', email_hash: hashedEmail });
      return {
        status: 429,
        jsonBody: { ok: false, message: 'Please wait before requesting another code' },
      };
    }
  }

  // Generate 6-digit OTP. randomInt's upper bound is exclusive, so we pass
  // 1_000_000 to keep the full 100000-999999 inclusive range.
  const code = String(randomInt(100000, 1_000_000));
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const insertResult = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('codeHash', sql.NVarChar(128), codeHash)
    .input('expiresAt', sql.DateTime2, expiresAt).query(`
      INSERT INTO admin_otps (email, code_hash, expires_at)
      OUTPUT inserted.id
      VALUES (@email, @codeHash, @expiresAt);
    `);

  const emailResult = await sendAdminOtpEmail(email, code, context);
  if (!emailResult.ok) {
    const otpId = insertResult.recordset[0].id;
    await pool
      .request()
      .input('id', sql.Int, otpId)
      .query('UPDATE admin_otps SET used = 1 WHERE id = @id;');

    const acsSendStatus =
      emailResult.status === 'non_succeeded' && emailResult.acsStatus
        ? `non_succeeded_status:${emailResult.acsStatus}`
        : emailResult.status;
    logSendAttempt(context, {
      outcome: 'acs_failed',
      email_hash: hashedEmail,
      latency_ms: emailResult.latencyMs,
      acs_send_status: acsSendStatus,
      ...(emailResult.messageId ? { acs_message_id: emailResult.messageId } : {}),
      ...(emailResult.errorName ? { error_name: emailResult.errorName } : {}),
    });

    return {
      status: 503,
      jsonBody: { ok: false, message: 'Could not send verification code. Please try again later.' },
    };
  }

  if (emailResult.skipped) {
    logSendAttempt(context, {
      outcome: 'dev_skipped',
      email_hash: hashedEmail,
      latency_ms: emailResult.latencyMs,
    });
  } else {
    logSendAttempt(context, {
      outcome: 'sent',
      email_hash: hashedEmail,
      latency_ms: emailResult.latencyMs,
      ...(emailResult.messageId ? { acs_message_id: emailResult.messageId } : {}),
    });
  }

  return successResponse;
};

app.http('requestOtp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/request-otp',
  handler,
});
