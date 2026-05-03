import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdmin } from '../lib/adminAuth.js';
import { invalidateLeaderboardCache, invalidatePublicConfigCache } from '../lib/cache.js';
import {
  boundedInteger,
  isDuplicateSqlKeyError,
  isHttpsUrl,
  readJsonObject,
  stringValue,
} from './http.js';

const TOTAL_PACKS_MIN = 1;
const TOTAL_PACKS_MAX = 10_000;
const TOTAL_WEEKS_MIN = 1;
const TOTAL_WEEKS_MAX = 52;
const DEFAULT_COPILOT_URL = 'https://m365.cloud.microsoft/chat';
const DEFAULT_TOTAL_PACKS = 999;
const DEFAULT_TOTAL_WEEKS = 7;

function badRequest(message: string) {
  return { status: 400, jsonBody: { ok: false, message } };
}

// Required-field bounds resolution. Returns the integer when the caller
// supplied a valid in-range value, the `defaultValue` when the field is
// omitted, or the literal `'out_of_range'` sentinel when the caller supplied
// a value that does not pass `boundedInteger`. Callers MUST translate the
// sentinel into a 400 response.
function resolveBoundedField(
  raw: unknown,
  min: number,
  max: number,
  defaultValue: number,
): number | 'out_of_range' {
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const parsed = boundedInteger(raw, min, max);
  if (parsed === null) return 'out_of_range';
  return parsed;
}

// Optional-field bounds resolution. Returns `null` (so the SQL COALESCE
// preserves the existing column) when the field is omitted, the parsed
// integer when valid, or `'out_of_range'` when explicitly invalid.
function resolveOptionalBoundedField(
  raw: unknown,
  min: number,
  max: number,
): number | null | 'out_of_range' {
  if (raw === undefined || raw === null || raw === '') return null;
  const parsed = boundedInteger(raw, min, max);
  if (parsed === null) return 'out_of_range';
  return parsed;
}

async function listCampaigns(request: HttpRequest, _context: InvocationContext) {
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

async function createCampaign(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonObject(request);
  const id = stringValue(body.id).trim();
  const displayName = stringValue(body.displayName).trim();
  if (!id || !displayName) {
    return badRequest('id and displayName are required');
  }

  // Bounds-check explicit numeric values; fall back to defaults only when the
  // caller omitted the field. An out-of-range explicit value is a 400 — silent
  // clamping would hide admin typos that could blow up pack-assignment loops.
  const totalPacks = resolveBoundedField(
    body.totalPacks,
    TOTAL_PACKS_MIN,
    TOTAL_PACKS_MAX,
    DEFAULT_TOTAL_PACKS,
  );
  if (totalPacks === 'out_of_range') {
    return badRequest(`totalPacks must be between ${TOTAL_PACKS_MIN} and ${TOTAL_PACKS_MAX}`);
  }
  const totalWeeks = resolveBoundedField(
    body.totalWeeks,
    TOTAL_WEEKS_MIN,
    TOTAL_WEEKS_MAX,
    DEFAULT_TOTAL_WEEKS,
  );
  if (totalWeeks === 'out_of_range') {
    return badRequest(`totalWeeks must be between ${TOTAL_WEEKS_MIN} and ${TOTAL_WEEKS_MAX}`);
  }

  // Reject non-https URLs (notably `javascript:`, `data:`, plain `http:`) so
  // a stored value can be safely bound to `:href` later. Empty / omitted falls
  // back to the project default.
  const copilotUrlInput = stringValue(body.copilotUrl).trim();
  if (copilotUrlInput && !isHttpsUrl(copilotUrlInput)) {
    return badRequest('copilotUrl must be an https:// URL');
  }
  const copilotUrl = copilotUrlInput || DEFAULT_COPILOT_URL;

  const pool = await getPool();
  try {
    await pool
      .request()
      .input('id', sql.NVarChar(20), id)
      .input('displayName', sql.NVarChar(100), displayName)
      .input('totalPacks', sql.Int, totalPacks)
      .input('totalWeeks', sql.Int, totalWeeks)
      .input('copilotUrl', sql.NVarChar(500), copilotUrl).query(`
        INSERT INTO campaigns (id, display_name, total_packs, total_weeks, copilot_url, is_active)
        VALUES (@id, @displayName, @totalPacks, @totalWeeks, @copilotUrl, 0);
      `);
    await invalidatePublicConfigCache(context);
    return { jsonBody: { ok: true } };
  } catch (err) {
    if (isDuplicateSqlKeyError(err)) {
      return { status: 409, jsonBody: { ok: false, message: 'Campaign already exists' } };
    }
    throw err;
  }
}

async function updateCampaignSettings(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaignId = request.params.id;
  const body = await readJsonObject(request);
  const { displayName, copilotUrl, isActive } = body;

  // Validate optional numeric inputs: present-but-invalid is 400; absent or
  // null leaves the existing column value alone via COALESCE in the SQL below.
  const totalPacks = resolveOptionalBoundedField(body.totalPacks, TOTAL_PACKS_MIN, TOTAL_PACKS_MAX);
  if (totalPacks === 'out_of_range') {
    return badRequest(`totalPacks must be between ${TOTAL_PACKS_MIN} and ${TOTAL_PACKS_MAX}`);
  }
  const totalWeeks = resolveOptionalBoundedField(body.totalWeeks, TOTAL_WEEKS_MIN, TOTAL_WEEKS_MAX);
  if (totalWeeks === 'out_of_range') {
    return badRequest(`totalWeeks must be between ${TOTAL_WEEKS_MIN} and ${TOTAL_WEEKS_MAX}`);
  }

  // copilotUrl: an empty / omitted value preserves the existing column via
  // COALESCE; a non-empty value MUST be an https URL.
  const copilotUrlInput = stringValue(copilotUrl).trim();
  if (copilotUrlInput && !isHttpsUrl(copilotUrlInput)) {
    return badRequest('copilotUrl must be an https:// URL');
  }
  const copilotUrlForSql = copilotUrlInput ? copilotUrlInput : null;

  const pool = await getPool();

  // If setting this campaign active, deactivate all others
  if (isActive) {
    await pool
      .request()
      .input('id', sql.NVarChar(20), campaignId)
      .query('UPDATE campaigns SET is_active = 0 WHERE id != @id;');
  }

  const result = await pool
    .request()
    .input('id', sql.NVarChar(20), campaignId)
    .input('displayName', sql.NVarChar(100), displayName)
    .input('totalPacks', sql.Int, totalPacks)
    .input('totalWeeks', sql.Int, totalWeeks)
    .input('copilotUrl', sql.NVarChar(500), copilotUrlForSql)
    .input('isActive', sql.Bit, isActive ? 1 : 0).query(`
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

  await invalidatePublicConfigCache(context);
  await invalidateLeaderboardCache(campaignId, context);

  return { jsonBody: { ok: true } };
}

async function clearCampaignData(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaignId = request.params.id;
  const pool = await getPool();

  // Delete in FK order: tile_events → game_sessions → submissions
  const events = await pool.request().input('campaignId', sql.NVarChar(20), campaignId).query(`
      DELETE te FROM tile_events te
      INNER JOIN game_sessions gs ON te.game_session_id = gs.id
      WHERE gs.campaign_id = @campaignId;
    `);

  const sessions = await pool
    .request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query('DELETE FROM game_sessions WHERE campaign_id = @campaignId;');

  const submissions = await pool
    .request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query('DELETE FROM submissions WHERE campaign_id = @campaignId;');

  await invalidateLeaderboardCache(campaignId, context);

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

async function resetLeaderboard(request: HttpRequest, context: InvocationContext) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const campaignId = request.params.id;
  const pool = await getPool();

  const result = await pool
    .request()
    .input('campaignId', sql.NVarChar(20), campaignId)
    .query('DELETE FROM submissions WHERE campaign_id = @campaignId;');

  await invalidateLeaderboardCache(campaignId, context);

  return {
    jsonBody: { ok: true, deleted: { submissions: result.rowsAffected[0] } },
  };
}

app.http('adminListCampaigns', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'portal-api/campaigns',
  handler: listCampaigns,
});
app.http('adminCreateCampaign', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/campaigns',
  handler: createCampaign,
});
app.http('adminUpdateCampaignSettings', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'portal-api/campaigns/{id}/settings',
  handler: updateCampaignSettings,
});
app.http('adminClearCampaignData', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/campaigns/{id}/clear',
  handler: clearCampaignData,
});
app.http('adminResetLeaderboard', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'portal-api/campaigns/{id}/reset-leaderboard',
  handler: resetLeaderboard,
});

export {
  listCampaigns,
  createCampaign,
  updateCampaignSettings,
  clearCampaignData,
  resetLeaderboard,
};
