import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdmin } from '../lib/adminAuth.js';
import { invalidateLeaderboardCache, invalidateOrgDomainCache } from '../lib/cache.js';
import { isDuplicateSqlKeyError, readJsonObject, stringValue } from './http.js';

async function listOrganizations(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const pool = await getPool();
  const orgs = await pool.request().query(`
    SELECT o.id, o.name,
      (SELECT od.id, od.domain FROM org_domains od WHERE od.org_id = o.id FOR JSON PATH) AS domains
    FROM organizations o
    ORDER BY o.name;
  `);

  return {
    jsonBody: {
      organizations: orgs.recordset.map((o) => ({
        id: o.id,
        name: o.name,
        domains: o.domains ? JSON.parse(String(o.domains)) : [],
      })),
    },
  };
}

async function createOrganization(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonObject(request);
  const name = stringValue(body.name).trim();
  if (!name) {
    return { status: 400, jsonBody: { ok: false, message: 'Name is required' } };
  }

  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input('name', sql.NVarChar(100), name)
      .query('INSERT INTO organizations (name) OUTPUT inserted.id VALUES (@name);');
    await invalidateOrgDomainCache(context);
    await invalidateLeaderboardCache(null, context);
    return { jsonBody: { ok: true, id: result.recordset[0].id } };
  } catch (err) {
    if (isDuplicateSqlKeyError(err)) {
      return { status: 409, jsonBody: { ok: false, message: 'Organization already exists' } };
    }
    throw err;
  }
}

async function updateOrganization(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid organization id' } };
  }

  const body = await readJsonObject(request);
  const name = stringValue(body.name).trim();
  if (!name) {
    return { status: 400, jsonBody: { ok: false, message: 'Name is required' } };
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), name)
    .query('UPDATE organizations SET name = @name WHERE id = @id;');

  if (result.rowsAffected[0] === 0) {
    return { status: 404, jsonBody: { ok: false, message: 'Organization not found' } };
  }

  await invalidateOrgDomainCache(context);
  await invalidateLeaderboardCache(null, context);

  return { jsonBody: { ok: true } };
}

async function deleteOrganization(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid organization id' } };
  }

  const pool = await getPool();

  // Check for existing submissions
  const subs = await pool
    .request()
    .input('orgId', sql.Int, id)
    .query('SELECT COUNT(*) AS cnt FROM submissions WHERE org_id = @orgId;');

  if (subs.recordset[0].cnt > 0) {
    return {
      status: 409,
      jsonBody: { ok: false, message: 'Cannot delete organization with existing submissions' },
    };
  }

  // Delete domain mappings first, then org
  await pool
    .request()
    .input('orgId', sql.Int, id)
    .query('DELETE FROM org_domains WHERE org_id = @orgId;');
  await pool.request().input('id', sql.Int, id).query('DELETE FROM organizations WHERE id = @id;');

  await invalidateOrgDomainCache(context);
  await invalidateLeaderboardCache(null, context);

  return { jsonBody: { ok: true } };
}

async function addDomain(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const orgId = parseInt(request.params.id, 10);
  if (isNaN(orgId)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid organization id' } };
  }

  const body = await readJsonObject(request);
  const domain = stringValue(body.domain).trim().toLowerCase();
  if (!domain) {
    return { status: 400, jsonBody: { ok: false, message: 'Domain is required' } };
  }

  const pool = await getPool();
  try {
    await pool
      .request()
      .input('orgId', sql.Int, orgId)
      .input('domain', sql.NVarChar(255), domain)
      .query('INSERT INTO org_domains (org_id, domain) VALUES (@orgId, @domain);');
    await invalidateOrgDomainCache(context);
    await invalidateLeaderboardCache(null, context);
    return { jsonBody: { ok: true } };
  } catch (err) {
    if (isDuplicateSqlKeyError(err)) {
      return { status: 409, jsonBody: { ok: false, message: 'Domain already mapped' } };
    }
    throw err;
  }
}

async function removeDomain(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const domainId = parseInt(request.params.domainId, 10);
  if (isNaN(domainId)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid domain id' } };
  }

  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, domainId)
    .query('DELETE FROM org_domains WHERE id = @id;');

  await invalidateOrgDomainCache(context);
  await invalidateLeaderboardCache(null, context);

  return { jsonBody: { ok: true } };
}

app.http('adminListOrganizations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'portal-api/organizations',
  handler: listOrganizations,
});
app.http('adminCreateOrganization', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/organizations',
  handler: createOrganization,
});
app.http('adminUpdateOrganization', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'portal-api/organizations/{id}',
  handler: updateOrganization,
});
app.http('adminDeleteOrganization', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'portal-api/organizations/{id}',
  handler: deleteOrganization,
});
app.http('adminAddDomain', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/organizations/{id}/domains',
  handler: addDomain,
});
app.http('adminRemoveDomain', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'portal-api/organizations/{id}/domains/{domainId}',
  handler: removeDomain,
});

export {
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  addDomain,
  removeDomain,
};
