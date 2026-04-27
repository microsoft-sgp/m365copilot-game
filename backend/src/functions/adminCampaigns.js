import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdmin } from '../lib/adminAuth.js';

async function listCampaigns(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT c.id, c.display_name, c.total_packs, c.total_weeks, c.copilot_url, c.is_active, c.created_at,
      (SELECT COUNT(DISTINCT gs.player_id) FROM game_sessions gs WHERE gs.campaign_id = c.id) AS total_players,
      (SELECT COUNT(*) FROM game_sessions gs WHERE gs.campaign_id = c.id) AS total_sessions,
      (SELECT COUNT(*) FROM submissions s WHERE s.campaign_id = c.id) AS total_submissions
    FROM campaigns c
    ORDER BY c.created_at DESC;
  `);

  return {
    jsonBody: {
      campaigns: result.recordset.map((c) => ({
        id: c.id,
        displayName: c.display_name,
        totalPacks: c.total_packs,
        totalWeeks: c.total_weeks,
        copilotUrl: c.copilot_url,
        isActive: c.is_active,
        createdAt: c.created_at,
        stats: {
          totalPlayers: c.total_players,
          totalSessions: c.total_sessions,
          totalSubmissions: c.total_submissions,
        },
      })),
    },
  };
}

async function createCampaign(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, displayName, totalPacks, totalWeeks, copilotUrl } = body;
  if (!id || !displayName) {
    return { status: 400, jsonBody: { ok: false, message: 'id and displayName are required' } };
  }

  const pool = await getPool();
  try {
    await pool.request()
      .input('id', sql.NVarChar(20), id)
      .input('displayName', sql.NVarChar(100), displayName)
      .input('totalPacks', sql.Int, totalPacks || 999)
      .input('totalWeeks', sql.Int, totalWeeks || 7)
      .input('copilotUrl', sql.NVarChar(500), copilotUrl || 'https://m365.cloud.microsoft/chat')
      .query(`
        INSERT INTO campaigns (id, display_name, total_packs, total_weeks, copilot_url, is_active)
        VALUES (@id, @displayName, @totalPacks, @totalWeeks, @copilotUrl, 0);
      `);
    return { jsonBody: { ok: true } };
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      return { status: 409, jsonBody: { ok: false, message: 'Campaign already exists' } };
    }
    throw err;
  }
}

async function updateCampaignSettings(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaignId = request.params.id;
  const body = await request.json();
  const { displayName, totalPacks, totalWeeks, copilotUrl, isActive } = body;

  const pool = await getPool();

  // If setting this campaign active, deactivate all others
  if (isActive) {
    await pool.request()
      .input('id', sql.NVarChar(20), campaignId)
      .query('UPDATE campaigns SET is_active = 0 WHERE id != @id;');
  }

  const result = await pool.request()
    .input('id', sql.NVarChar(20), campaignId)
    .input('displayName', sql.NVarChar(100), displayName)
    .input('totalPacks', sql.Int, totalPacks)
    .input('totalWeeks', sql.Int, totalWeeks)
    .input('copilotUrl', sql.NVarChar(500), copilotUrl)
    .input('isActive', sql.Bit, isActive ? 1 : 0)
    .query(`
      UPDATE campaigns
      SET display_name = COALESCE(@displayName, display_name),
          total_packs = COALESCE(@totalPacks, total_packs),
          total_weeks = COALESCE(@totalWeeks, total_weeks),
          copilot_url = COALESCE(@copilotUrl, copilot_url),
          is_active = @isActive
      WHERE id = @id;
    `);

  if (result.rowsAffected[0] === 0) {
    return { status: 404, jsonBody: { ok: false, message: 'Campaign not found' } };
  }

  return { jsonBody: { ok: true } };
}

async function clearCampaignData(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaignId = request.params.id;
  const pool = await getPool();

  // Delete in FK order: tile_events → game_sessions → submissions
  const events = await pool.request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query(`
      DELETE te FROM tile_events te
      INNER JOIN game_sessions gs ON te.game_session_id = gs.id
      WHERE gs.campaign_id = @campaignId;
    `);

  const sessions = await pool.request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query('DELETE FROM game_sessions WHERE campaign_id = @campaignId;');

  const submissions = await pool.request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query('DELETE FROM submissions WHERE campaign_id = @campaignId;');

  return {
    jsonBody: {
      ok: true,
      deleted: {
        events: events.rowsAffected[0],
        sessions: sessions.rowsAffected[0],
        submissions: submissions.rowsAffected[0],
      },
    },
  };
}

async function resetLeaderboard(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaignId = request.params.id;
  const pool = await getPool();

  const result = await pool.request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query('DELETE FROM submissions WHERE campaign_id = @campaignId;');

  return {
    jsonBody: { ok: true, deleted: { submissions: result.rowsAffected[0] } },
  };
}

app.http('adminListCampaigns', { methods: ['GET'], authLevel: 'anonymous', route: 'portal-api/campaigns', handler: listCampaigns });
app.http('adminCreateCampaign', { methods: ['POST'], authLevel: 'anonymous', route: 'portal-api/campaigns', handler: createCampaign });
app.http('adminUpdateCampaignSettings', { methods: ['PUT'], authLevel: 'anonymous', route: 'portal-api/campaigns/{id}/settings', handler: updateCampaignSettings });
app.http('adminClearCampaignData', { methods: ['POST'], authLevel: 'anonymous', route: 'portal-api/campaigns/{id}/clear', handler: clearCampaignData });
app.http('adminResetLeaderboard', { methods: ['POST'], authLevel: 'anonymous', route: 'portal-api/campaigns/{id}/reset-leaderboard', handler: resetLeaderboard });
