import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdmin } from '../lib/adminAuth.js';

export const handler = async (request, context) => {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaign = request.query.get('campaign') || 'APR26';
  const useLegacySubmissionSource = process.env.LEADERBOARD_SOURCE === 'submissions';
  const pool = await getPool();

  const result = await pool
    .request()
    .input('campaign', sql.NVarChar(20), campaign)
    .query(useLegacySubmissionSource
      ? `
        SELECT o.name AS org, p.player_name, p.email, s.keyword, s.created_at AS submitted_at
        FROM submissions s
        JOIN players p ON s.player_id = p.id
        JOIN organizations o ON s.org_id = o.id
        WHERE s.campaign_id = @campaign
        ORDER BY s.created_at ASC;
      `
      : `
        SELECT
          COALESCE(o.name, 'UNMAPPED') AS org,
          p.player_name,
          p.email,
          ps.event_type,
          ps.event_key,
          ps.keyword,
          ps.created_at AS submitted_at
        FROM progression_scores ps
        JOIN players p ON ps.player_id = p.id
        LEFT JOIN organizations o ON ps.org_id = o.id
        WHERE ps.campaign_id = @campaign
        ORDER BY ps.created_at ASC;
      `);

  const header = useLegacySubmissionSource
    ? 'org,player_name,email,keyword,submitted_at'
    : 'org,player_name,email,event_type,event_key,keyword,submitted_at';
  const rows = result.recordset.map((r) => {
    const escapeCsv = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const base = [
      escapeCsv(r.org),
      escapeCsv(r.player_name),
      escapeCsv(r.email),
    ];
    if (useLegacySubmissionSource) {
      base.push(escapeCsv(r.keyword));
    } else {
      base.push(escapeCsv(r.event_type));
      base.push(escapeCsv(r.event_key));
      base.push(escapeCsv(r.keyword));
    }
    base.push(escapeCsv(r.submitted_at));
    return base.join(',');
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
  route: 'portal-api/export',
  handler,
});
