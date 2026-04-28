import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { getPool } from '../lib/db.js';
import { CACHE_KEYS, cacheGetJson, cacheSetJson, getPublicCacheTtlSeconds } from '../lib/cache.js';

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const cached = await cacheGetJson(CACHE_KEYS.orgDomains, context);
  if (cached) return { jsonBody: cached };

  const pool = await getPool();

  const result = await pool.request().query(`
      SELECT od.domain, o.name AS org
      FROM org_domains od
      JOIN organizations o ON o.id = od.org_id;
    `);

  const domains: Record<string, string> = {};
  for (const row of result.recordset) {
    domains[row.domain] = row.org;
  }

  const jsonBody = { domains };
  await cacheSetJson(
    CACHE_KEYS.orgDomains,
    jsonBody,
    getPublicCacheTtlSeconds('orgDomains'),
    context,
  );

  return { jsonBody };
};

app.http('getOrgDomains', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'organizations/domains',
  handler,
});
