import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { createHash } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import {
  hashOtp,
  signAdminRefreshToken,
  signAdminStepUpToken,
  signAdminToken,
  getEffectiveAdminEmails,
  normalizeEmail,
} from '../lib/adminAuth.js';
import {
  createAdminCookie,
  getAdminAccessTtlSeconds,
  getAdminRefreshTtlSeconds,
  getAdminStepUpTtlSeconds,
} from '../lib/adminCookies.js';
import { cacheDelete, cacheGetCounter, cacheIncrementWithTtl } from '../lib/cache.js';
import { readJsonObject, stringValue } from './http.js';

// Brute-force lockout window. Five failed verify attempts within ten minutes
// blocks further verification for the rest of the window. Tracked in Redis
// because the OTP itself only lives 10 minutes and a cold counter would let
// an attacker spread guesses across processes.
const MAX_VERIFY_FAILURES = 5;
const LOCKOUT_WINDOW_SECONDS = 10 * 60;

function lockoutKey(email: string): string {
  return `admin_otp_verify_failures:${email}`;
}

function emailHash(email: string): string {
  // 12 hex chars of SHA-256 is enough to correlate one admin's attempts in
  // logs without leaking the address itself.
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}

type VerifyFailureOutcome =
  | 'invalid_email'
  | 'invalid_code'
  | 'expired_code'
  | 'used_code'
  | 'locked_out'
  | 'invalid_step_up_request';

function logVerifyFailure(
  context: InvocationContext,
  outcome: VerifyFailureOutcome,
  email: string,
  failureCount: number | null,
): void {
  if (typeof context.log !== 'function') return;
  context.log('admin_otp_verify_failure', {
    outcome,
    email_hash: emailHash(email),
    ...(failureCount !== null ? { failure_count: failureCount } : {}),
  });
}

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const pool = await getPool();
  const adminEmails = await getEffectiveAdminEmails(pool);
  if (adminEmails.length === 0) {
    return {
      status: 500,
      jsonBody: { ok: false, message: 'Admin access not configured' },
    };
  }

  const body = await readJsonObject(request);
  const email = normalizeEmail(stringValue(body.email));
  const code = stringValue(body.code).trim();
  const purpose = stringValue(body.purpose).trim();
  const action = stringValue(body.action).trim();
  const targetEmail = normalizeEmail(stringValue(body.targetEmail));

  if (!email || !code) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Email and code are required' },
    };
  }

  if (!adminEmails.includes(email)) {
    logVerifyFailure(context, 'invalid_email', email, null);
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid code' },
    };
  }

  // Block lookup entirely while the email is locked out so an attacker cannot
  // probe the database column for code_hash collisions.
  const existingFailures = await cacheGetCounter(lockoutKey(email), context);
  if (existingFailures >= MAX_VERIFY_FAILURES) {
    logVerifyFailure(context, 'locked_out', email, existingFailures);
    return {
      status: 429,
      jsonBody: {
        ok: false,
        message: 'Too many invalid attempts. Please request a new code and try again later.',
      },
    };
  }

  const codeHash = hashOtp(code);

  // Find matching, unused, non-expired OTP
  const result = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('codeHash', sql.NVarChar(128), codeHash).query(`
      SELECT TOP 1 id, expires_at, used FROM admin_otps
      WHERE email = @email AND code_hash = @codeHash
      ORDER BY created_at DESC;
    `);

  if (result.recordset.length === 0) {
    const failures = await cacheIncrementWithTtl(
      lockoutKey(email),
      LOCKOUT_WINDOW_SECONDS,
      context,
    );
    logVerifyFailure(context, 'invalid_code', email, failures);
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid code' },
    };
  }

  const otp = result.recordset[0];

  if (otp.used) {
    const failures = await cacheIncrementWithTtl(
      lockoutKey(email),
      LOCKOUT_WINDOW_SECONDS,
      context,
    );
    logVerifyFailure(context, 'used_code', email, failures);
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Code already used. Please request a new one.' },
    };
  }

  if (new Date(otp.expires_at) < new Date()) {
    logVerifyFailure(context, 'expired_code', email, existingFailures);
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Code expired. Please request a new one.' },
    };
  }

  const markUsedResult = await pool
    .request()
    .input('id', sql.Int, otp.id)
    .query('UPDATE admin_otps SET used = 1 WHERE id = @id AND used = 0;');

  if (markUsedResult.rowsAffected?.[0] !== 1) {
    const failures = await cacheIncrementWithTtl(
      lockoutKey(email),
      LOCKOUT_WINDOW_SECONDS,
      context,
    );
    logVerifyFailure(context, 'used_code', email, failures);
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Code already used. Please request a new one.' },
    };
  }

  if (purpose === 'admin-management') {
    if (!['add-admin', 'remove-admin'].includes(action) || !targetEmail) {
      logVerifyFailure(context, 'invalid_step_up_request', email, existingFailures);
      return {
        status: 400,
        jsonBody: { ok: false, message: 'Admin management action and target email are required' },
      };
    }
    // Successful step-up: clear any prior failure counter so a future legitimate
    // burst of typos does not unjustly carry over.
    await cacheDelete(lockoutKey(email), context);
    const stepUpToken = signAdminStepUpToken(email, { action, targetEmail });
    return {
      cookies: [
        createAdminCookie('stepUp', stepUpToken, { maxAgeSeconds: getAdminStepUpTtlSeconds() }),
      ],
      jsonBody: { ok: true },
    };
  }

  await cacheDelete(lockoutKey(email), context);
  const accessToken = signAdminToken(email);
  const refreshToken = signAdminRefreshToken(email);

  return {
    cookies: [
      createAdminCookie('access', accessToken, { maxAgeSeconds: getAdminAccessTtlSeconds() }),
      createAdminCookie('refresh', refreshToken, { maxAgeSeconds: getAdminRefreshTtlSeconds() }),
    ],
    jsonBody: { ok: true },
  };
};

app.http('verifyOtp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/verify-otp',
  handler,
});
