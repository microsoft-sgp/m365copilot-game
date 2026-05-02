import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import {
  getPlayerTokenFromRequest,
  isPlayerTokenEnforcementEnabled,
  verifyPlayerTokenForPlayer,
} from '../lib/playerAuth.js';
import { numberValue, readJsonObject } from './http.js';

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Invalid session id.' },
    };
  }

  const body = await readJsonObject(request);
  const tilesCleared = numberValue(body.tilesCleared) ?? 0;
  const linesWon = numberValue(body.linesWon) ?? 0;
  const keywordsEarned = numberValue(body.keywordsEarned) ?? 0;
  const { boardState } = body;

  const pool = await getPool();

  // When enforcement is on, the request token must hash to the owning
  // player's owner_token. We project owner_token in the same lookup so the
  // check costs no extra round-trip; the LEFT JOIN keeps the legacy null
  // case alive when the flag is off.
  if (isPlayerTokenEnforcementEnabled()) {
    const ownership = await pool
      .request()
      .input('id', sql.Int, id)
      .query<{ player_id: number; owner_token: string | null }>(`
        SELECT TOP 1 p.id AS player_id, p.owner_token
        FROM game_sessions gs
        JOIN players p ON p.id = gs.player_id
        WHERE gs.id = @id;
      `);
    const owner = ownership.recordset[0];
    const presentedToken = getPlayerTokenFromRequest(request);
    if (
      !owner ||
      !(await verifyPlayerTokenForPlayer(pool, {
        playerId: owner.player_id,
        ownerTokenHash: owner.owner_token,
        presentedToken,
      }))
    ) {
      return {
        status: 401,
        jsonBody: { ok: false, message: 'Unauthorized' },
      };
    }
  }

  const boardStateJson = boardState ? JSON.stringify(boardState) : null;
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('tilesCleared', sql.Int, tilesCleared)
    .input('linesWon', sql.Int, linesWon)
    .input('keywordsEarned', sql.Int, keywordsEarned)
    .input('boardState', sql.NVarChar(sql.MAX), boardStateJson).query(`
      UPDATE game_sessions
      SET tiles_cleared   = @tilesCleared,
          lines_won       = @linesWon,
          keywords_earned = @keywordsEarned,
          board_state     = COALESCE(@boardState, board_state),
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
