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

  return { jsonBody: { ok: true } };
};

app.http('recordEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events',
  handler,
});
