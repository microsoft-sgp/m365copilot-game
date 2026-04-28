import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
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
    return {
      status: 401,
      jsonBody: { ok: false, message: 'Invalid code' },
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

  if (purpose === 'admin-management') {
    if (!['add-admin', 'remove-admin'].includes(action) || !targetEmail) {
      return {
        status: 400,
        jsonBody: { ok: false, message: 'Admin management action and target email are required' },
      };
    }
    const stepUpToken = signAdminStepUpToken(email, { action, targetEmail });
    return {
      cookies: [
        createAdminCookie('stepUp', stepUpToken, { maxAgeSeconds: getAdminStepUpTtlSeconds() }),
      ],
      jsonBody: { ok: true },
    };
  }

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
