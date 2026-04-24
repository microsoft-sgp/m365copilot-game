import { app } from '@azure/functions';
import { getPool } from '../lib/db.js';

export const handler = async (request, context) => {
  const pool = await getPool();

  const result = await pool
    .request()
    .query(`
      SELECT od.domain, o.name AS org
      FROM org_domains od
      JOIN organizations o ON o.id = od.org_id;
    `);

  const domains = {};
  for (const row of result.recordset) {
    domains[row.domain] = row.org;
  }

  return {
    jsonBody: { domains },
  };
};

app.http('getOrgDomains', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'organizations/domains',
  handler,
});
