import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import {
  getAdminEmails,
  getDatabaseAdminEmails,
  normalizeEmail,
  verifyAdmin,
  verifyAdminStepUpToken,
} from '../lib/adminAuth.js';

function requireStepUp(stepUpToken, actingEmail, action, targetEmail) {
  const proof = verifyAdminStepUpToken(stepUpToken, actingEmail, { action, targetEmail });
  if (proof.ok) return null;
  return {
    status: 403,
    jsonBody: { ok: false, message: proof.message },
  };
}

async function listAdmins(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const pool = await getPool();
  const bootstrapEmails = getAdminEmails();
  const portalResult = await pool.request().query(`
    SELECT id, email, is_active, created_at, created_by, disabled_at, disabled_by
    FROM admin_users
    ORDER BY is_active DESC, email ASC;
  `);

  const admins = [
    ...bootstrapEmails.map((email) => ({
      email,
      source: 'bootstrap',
      isActive: true,
      readOnly: true,
    })),
    ...portalResult.recordset.map((admin) => ({
      id: admin.id,
      email: admin.email,
      source: 'portal',
      isActive: Boolean(admin.is_active),
      readOnly: false,
      createdAt: admin.created_at,
      createdBy: admin.created_by,
      disabledAt: admin.disabled_at,
      disabledBy: admin.disabled_by,
    })),
  ];

  return { jsonBody: { admins } };
}

async function addAdmin(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) {
    return { status: 400, jsonBody: { ok: false, message: 'Valid email is required' } };
  }

  const stepUpFailure = requireStepUp(body.stepUpToken, auth.email, 'add-admin', email);
  if (stepUpFailure) return stepUpFailure;

  const pool = await getPool();
  await pool.request()
    .input('email', sql.NVarChar(320), email)
    .input('createdBy', sql.NVarChar(320), auth.email)
    .query(`
      MERGE admin_users AS target
      USING (SELECT @email AS email) AS source
      ON target.email = source.email
      WHEN MATCHED THEN
        UPDATE SET is_active = 1, disabled_at = NULL, disabled_by = NULL
      WHEN NOT MATCHED THEN
        INSERT (email, created_by) VALUES (@email, @createdBy);
    `);

  return { jsonBody: { ok: true } };
}

async function removeAdmin(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const email = normalizeEmail(request.params.email);
  if (!email || !email.includes('@')) {
    return { status: 400, jsonBody: { ok: false, message: 'Valid email is required' } };
  }

  const stepUpFailure = requireStepUp(body.stepUpToken, auth.email, 'remove-admin', email);
  if (stepUpFailure) return stepUpFailure;

  if (getAdminEmails().includes(email)) {
    return {
      status: 409,
      jsonBody: { ok: false, message: 'Bootstrap admins are managed through Function App settings' },
    };
  }

  const pool = await getPool();
  const activeDbAdmins = await getDatabaseAdminEmails(pool);
  if (getAdminEmails().length === 0 && activeDbAdmins.length <= 1 && activeDbAdmins.includes(email)) {
    return {
      status: 409,
      jsonBody: { ok: false, message: 'Cannot remove the last active admin' },
    };
  }

  const result = await pool.request()
    .input('email', sql.NVarChar(320), email)
    .input('disabledBy', sql.NVarChar(320), auth.email)
    .query(`
      UPDATE admin_users
      SET is_active = 0,
          disabled_at = SYSUTCDATETIME(),
          disabled_by = @disabledBy
      WHERE email = @email AND is_active = 1;
    `);

  if (result.rowsAffected[0] === 0) {
    return { status: 404, jsonBody: { ok: false, message: 'Admin not found' } };
  }

  return { jsonBody: { ok: true } };
}

app.http('adminListAdmins', { methods: ['GET'], authLevel: 'anonymous', route: 'portal-api/admins', handler: listAdmins });
app.http('adminAddAdmin', { methods: ['POST'], authLevel: 'anonymous', route: 'portal-api/admins', handler: addAdmin });
app.http('adminRemoveAdmin', { methods: ['DELETE'], authLevel: 'anonymous', route: 'portal-api/admins/{email}', handler: removeAdmin });

export { addAdmin, listAdmins, removeAdmin };