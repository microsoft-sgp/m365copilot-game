import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';

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
    .query('SELECT id FROM game_sessions WHERE id = @gameSessionId;');

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
    try {
      await pool
        .request()
        .input('gameSessionId', sql.Int, gameSessionId)
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
            p.id,
            od.org_id,
            gs.campaign_id,
            @eventType,
            @eventKey,
            @keyword
          FROM game_sessions gs
          JOIN players p ON p.id = gs.player_id
          LEFT JOIN org_domains od
            ON od.domain = LOWER(
              CASE
                WHEN CHARINDEX('@', p.email) > 0
                THEN SUBSTRING(p.email, CHARINDEX('@', p.email) + 1, LEN(p.email))
                ELSE ''
              END
            )
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
