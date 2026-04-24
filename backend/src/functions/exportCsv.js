import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdminKey } from '../lib/adminAuth.js';

export const handler = async (request, context) => {
  const auth = verifyAdminKey(request);
  if (!auth.ok) return auth.response;

  const campaign = request.query.get('campaign') || 'APR26';
  const pool = await getPool();

  const result = await pool
    .request()
    .input('campaign', sql.NVarChar(20), campaign)
    .query(`
      SELECT o.name AS org, p.player_name, p.email, s.keyword, s.created_at AS submitted_at
      FROM submissions s
      JOIN players p ON s.player_id = p.id
      JOIN organizations o ON s.org_id = o.id
      WHERE s.campaign_id = @campaign
      ORDER BY s.created_at ASC;
    `);

  const header = 'org,player_name,email,keyword,submitted_at';
  const rows = result.recordset.map((r) => {
    const escapeCsv = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    return [
      escapeCsv(r.org),
      escapeCsv(r.player_name),
      escapeCsv(r.email),
      escapeCsv(r.keyword),
      escapeCsv(r.submitted_at),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');

  return {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="submissions-${campaign}.csv"`,
    },
    body: csv,
  };
};

app.http('exportCsv', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/export',
  handler,
});
