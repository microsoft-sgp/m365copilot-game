import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';

export const handler = async (request, context) => {
  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Invalid session id.' },
    };
  }

  const body = await request.json();
  const { tilesCleared, linesWon, keywordsEarned } = body;

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('tilesCleared', sql.Int, tilesCleared ?? 0)
    .input('linesWon', sql.Int, linesWon ?? 0)
    .input('keywordsEarned', sql.Int, keywordsEarned ?? 0)
    .query(`
      UPDATE game_sessions
      SET tiles_cleared   = @tilesCleared,
          lines_won       = @linesWon,
          keywords_earned = @keywordsEarned,
          last_active_at  = SYSUTCDATETIME()
      WHERE id = @id;
    `);

  if (result.rowsAffected[0] === 0) {
    return {
      status: 404,
      jsonBody: { ok: false, message: 'Session not found' },
    };
  }

  return { jsonBody: { ok: true } };
};

app.http('updateSession', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'sessions/{id}',
  handler,
});
