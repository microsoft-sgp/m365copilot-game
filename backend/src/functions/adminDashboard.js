import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdminKey } from '../lib/adminAuth.js';

export const handler = async (request, context) => {
    const auth = verifyAdminKey(request);
    if (!auth.ok) return auth.response;

    const campaign = request.query.get('campaign') || 'APR26';
    const pool = await getPool();

    // Summary stats
    const summary = await pool
      .request()
      .input('campaign', sql.NVarChar(20), campaign)
      .query(`
        SELECT
          (SELECT COUNT(DISTINCT player_id) FROM game_sessions WHERE campaign_id = @campaign) AS totalPlayers,
          (SELECT COUNT(*) FROM game_sessions WHERE campaign_id = @campaign) AS totalSessions,
          (SELECT COUNT(*) FROM submissions WHERE campaign_id = @campaign) AS totalSubmissions,
          (SELECT AVG(CAST(tiles_cleared AS FLOAT)) FROM game_sessions WHERE campaign_id = @campaign) AS avgTilesCleared;
      `);

    // Top org
    const topOrgResult = await pool
      .request()
      .input('campaign', sql.NVarChar(20), campaign)
      .query(`
        SELECT TOP 1 o.name AS org, COUNT(DISTINCT s.keyword) AS score
        FROM submissions s
        JOIN organizations o ON s.org_id = o.id
        WHERE s.campaign_id = @campaign
        GROUP BY o.name
        ORDER BY score DESC;
      `);

    // Recent sessions
    const sessions = await pool
      .request()
      .input('campaign', sql.NVarChar(20), campaign)
      .query(`
        SELECT TOP 100
          gs.id, p.player_name, gs.pack_id, gs.tiles_cleared,
          gs.lines_won, gs.keywords_earned, gs.started_at, gs.last_active_at
        FROM game_sessions gs
        JOIN players p ON gs.player_id = p.id
        WHERE gs.campaign_id = @campaign
        ORDER BY gs.last_active_at DESC;
      `);

    // Recent submissions
    const submissions = await pool
      .request()
      .input('campaign', sql.NVarChar(20), campaign)
      .query(`
        SELECT TOP 100
          s.id, p.player_name, p.email, o.name AS org,
          s.keyword, s.created_at
        FROM submissions s
        JOIN players p ON s.player_id = p.id
        JOIN organizations o ON s.org_id = o.id
        WHERE s.campaign_id = @campaign
        ORDER BY s.created_at DESC;
      `);

    const stats = summary.recordset[0];
    return {
      jsonBody: {
        summary: {
          totalPlayers: stats.totalPlayers,
          totalSessions: stats.totalSessions,
          totalSubmissions: stats.totalSubmissions,
          avgTilesCleared: stats.avgTilesCleared != null ? Math.round(stats.avgTilesCleared * 10) / 10 : 0,
          topOrg: topOrgResult.recordset.length > 0 ? topOrgResult.recordset[0].org : null,
        },
        sessions: sessions.recordset,
        submissions: submissions.recordset,
      },
    };
};

app.http('adminDashboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/dashboard',
  handler,
});
