import { app } from '@azure/functions';
import { randomInt } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { hashOtp, getAdminEmails } from '../lib/adminAuth.js';

export const handler = async (request, context) => {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return {
      status: 500,
      jsonBody: { ok: false, message: 'Admin access not configured' },
    };
  }

  const body = await request.json();
  const email = (body.email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Valid email is required' },
    };
  }

  // Always return same response to prevent email enumeration
  const successResponse = { jsonBody: { ok: true, message: 'If this email is authorised, a code has been sent.' } };

  if (!adminEmails.includes(email)) {
    return successResponse;
  }

  const pool = await getPool();

  // Rate limit: 1 OTP per 60 seconds per email
  const recent = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .query(`
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

  await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('codeHash', sql.NVarChar(128), codeHash)
    .input('expiresAt', sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO admin_otps (email, code_hash, expires_at)
      VALUES (@email, @codeHash, @expiresAt);
    `);

  // Send OTP email via configured service
  // For now, log the code in non-production environments for testing
  if (process.env.NODE_ENV !== 'production') {
    context.log(`[DEV] Admin OTP for ${email}: ${code}`);
  }

  // TODO: Integrate email sending (Azure Communication Services or SMTP)
  // await sendOtpEmail(email, code);

  return successResponse;
};

app.http('requestOtp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/request-otp',
  handler,
});
