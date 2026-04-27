import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';

export const handler = async (request, context) => {
  const body = await request.json();
  const { gameSessionId, tileIndex, eventType, keyword, lineId } = body;

  if (gameSessionId == null || tileIndex == null || !eventType) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'gameSessionId, tileIndex, and eventType are required.' },
    };
  }

  const pool = await getPool();

  // Verify session exists
  const check = await pool
    .request()
    .input('gameSessionId', sql.Int, gameSessionId)
    .query(`
      SELECT TOP 1
        gs.id,
        gs.player_id,
        gs.campaign_id,
        p.email,
        p.org_id,
        o.name AS org_name
      FROM game_sessions gs
      JOIN players p ON p.id = gs.player_id
      LEFT JOIN organizations o ON o.id = p.org_id
      WHERE gs.id = @gameSessionId;
    `);

  if (check.recordset.length === 0) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Invalid session' },
    };
  }

  await pool
    .request()
    .input('gameSessionId', sql.Int, gameSessionId)
    .input('tileIndex', sql.Int, tileIndex)
    .input('eventType', sql.NVarChar(20), eventType)
    .input('keyword', sql.NVarChar(100), keyword || null)
    .input('lineId', sql.NVarChar(20), lineId || null)
    .query(`
      INSERT INTO tile_events (game_session_id, tile_index, event_type, keyword, line_id)
      VALUES (@gameSessionId, @tileIndex, @eventType, @keyword, @lineId);
    `);

  const scoreEventTypes = new Set(['line_won', 'weekly_won']);
  if (scoreEventTypes.has(eventType) && keyword) {
    const eventKey = lineId || keyword;
    const session = check.recordset[0];
    let orgId = session.org_id ?? null;

    if (!orgId && session.email) {
      const resolvedOrganization = await resolveOrganizationForEmail(pool, {
        email: session.email,
      });
      orgId = resolvedOrganization.orgId;

      if (orgId && session.player_id) {
        await pool
          .request()
          .input('playerId', sql.Int, session.player_id)
          .input('orgId', sql.Int, orgId)
          .query('UPDATE players SET org_id = @orgId WHERE id = @playerId AND org_id IS NULL;');
      }
    }

    try {
      await pool
        .request()
        .input('gameSessionId', sql.Int, gameSessionId)
        .input('orgId', sql.Int, orgId ?? null)
        .input('eventType', sql.NVarChar(20), eventType)
        .input('eventKey', sql.NVarChar(64), eventKey)
        .input('keyword', sql.NVarChar(100), keyword)
        .query(`
          INSERT INTO progression_scores (
            game_session_id,
            player_id,
            org_id,
            campaign_id,
            event_type,
            event_key,
            keyword
          )
          SELECT
            gs.id,
            gs.player_id,
            @orgId,
            gs.campaign_id,
            @eventType,
            @eventKey,
            @keyword
          FROM game_sessions gs
          WHERE gs.id = @gameSessionId;
        `);
    } catch (err) {
      if (err.number !== 2627 && err.number !== 2601) {
        throw err;
      }
    }
  }

  return { jsonBody: { ok: true } };
};

app.http('recordEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events',
  handler,
});
