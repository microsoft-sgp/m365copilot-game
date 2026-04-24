import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { hashOtp, signAdminToken, getAdminEmails } from '../lib/adminAuth.js';

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
  const code = (body.code || '').trim();

  if (!email || !code) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Email and code are required' },
    };
  }

  if (!adminEmails.includes(email)) {
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid code' },
    };
  }

  const pool = await getPool();
  const codeHash = hashOtp(code);

  // Find matching, unused, non-expired OTP
  const result = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('codeHash', sql.NVarChar(128), codeHash)
    .query(`
      SELECT TOP 1 id, expires_at, used FROM admin_otps
      WHERE email = @email AND code_hash = @codeHash
      ORDER BY created_at DESC;
    `);

  if (result.recordset.length === 0) {
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid code' },
    };
  }

  const otp = result.recordset[0];

  if (otp.used) {
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Code already used. Please request a new one.' },
    };
  }

  if (new Date(otp.expires_at) < new Date()) {
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Code expired. Please request a new one.' },
    };
  }

  // Mark OTP as used
  await pool
    .request()
    .input('id', sql.Int, otp.id)
    .query('UPDATE admin_otps SET used = 1 WHERE id = @id;');

  // Generate JWT
  const token = signAdminToken(email);

  return {
    jsonBody: { ok: true, token },
  };
};

app.http('verifyOtp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/verify-otp',
  handler,
});
