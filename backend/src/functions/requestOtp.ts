import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { randomInt } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { hashOtp, getEffectiveAdminEmails, normalizeEmail } from '../lib/adminAuth.js';
import { sendAdminOtpEmail } from '../lib/email.js';
import { readJsonObject, stringValue } from './http.js';

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

  if (!email || !email.includes('@')) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Valid email is required' },
    };
  }

  // Always return same response to prevent email enumeration
  const successResponse = {
    jsonBody: { ok: true, message: 'If this email is authorised, a code has been sent.' },
  };

  if (!adminEmails.includes(email)) {
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
      return {
        status: 429,
        jsonBody: { ok: false, message: 'Please wait before requesting another code' },
      };
    }
  }

  // Generate 6-digit OTP
  const code = String(randomInt(100000, 999999));
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

    return {
      status: 503,
      jsonBody: { ok: false, message: 'Could not send verification code. Please try again later.' },
    };
  }

  return successResponse;
};

app.http('requestOtp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/request-otp',
  handler,
});
