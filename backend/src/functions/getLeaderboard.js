import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';

export const handler = async (request, context) => {
  const campaign = request.query.get('campaign') || 'APR26';

  const pool = await getPool();
  const result = await pool
    .request()
    .input('campaign', sql.NVarChar(20), campaign)
    .query(`
      SELECT
        o.name AS org,
        COUNT(DISTINCT s.keyword) AS score,
        COUNT(DISTINCT p.email) AS contributors,
        MAX(s.created_at) AS lastSubmission
      FROM submissions s
      JOIN organizations o ON s.org_id = o.id
      JOIN players p ON s.player_id = p.id
      WHERE s.campaign_id = @campaign
      GROUP BY o.name
      ORDER BY score DESC, o.name ASC;
    `);

  const leaderboard = result.recordset.map((row, i) => ({
    rank: i + 1,
    org: row.org,
    score: row.score,
    contributors: row.contributors,
    lastSubmission: row.lastSubmission,
  }));

  return { jsonBody: { leaderboard } };
};

app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler,
});
