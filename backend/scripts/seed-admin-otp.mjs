import sql from 'mssql';
import { getPool } from '../dist/lib/db.js';
import { hashOtp, normalizeEmail } from '../dist/lib/adminAuth.js';

if (process.env.E2E_ENABLE_ADMIN_OTP_SEED !== '1') {
  throw new Error('Refusing to seed admin OTP without E2E_ENABLE_ADMIN_OTP_SEED=1.');
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed admin OTP when NODE_ENV=production.');
}

const email = normalizeEmail(process.env.ADMIN_E2E_EMAIL || 'admin-e2e@example.com');
const code = String(process.env.ADMIN_E2E_CODE || '123456').trim();

if (!email || !email.includes('@')) throw new Error('ADMIN_E2E_EMAIL must be a valid email.');
if (!/^\d{6}$/.test(code)) throw new Error('ADMIN_E2E_CODE must be a six-digit code.');

const pool = await getPool();
const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

await pool
  .request()
  .input('email', sql.NVarChar(320), email)
  .input('createdBy', sql.NVarChar(320), 'e2e-admin-otp-seed').query(`
    IF EXISTS (SELECT 1 FROM admin_users WHERE email = @email)
    BEGIN
      UPDATE admin_users
      SET is_active = 1, disabled_at = NULL, disabled_by = NULL
      WHERE email = @email;
    END
    ELSE
    BEGIN
      INSERT INTO admin_users (email, is_active, created_by)
      VALUES (@email, 1, @createdBy);
    END;
  `);

await pool
  .request()
  .input('email', sql.NVarChar(320), email)
  .query('UPDATE admin_otps SET used = 1 WHERE email = @email;');

await pool
  .request()
  .input('email', sql.NVarChar(320), email)
  .input('codeHash', sql.NVarChar(128), hashOtp(code))
  .input('expiresAt', sql.DateTime2, expiresAt).query(`
    INSERT INTO admin_otps (email, code_hash, expires_at, created_at)
    VALUES (@email, @codeHash, @expiresAt, DATEADD(second, -61, SYSUTCDATETIME()));
  `);

console.log(`Seeded local admin OTP for ${email}.`);
