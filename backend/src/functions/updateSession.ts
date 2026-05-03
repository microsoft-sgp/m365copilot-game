import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import {
  getPlayerTokenFromRequest,
  isPlayerTokenEnforcementEnabled,
  verifyPlayerTokenForPlayer,
} from '../lib/playerAuth.js';
import { numberValue, readJsonObject } from './http.js';

type SessionAccessRow = {
  player_id: number;
  owner_token: string | null;
  assignment_status: string | null;
};

function assignmentNotActiveResponse() {
  return {
    status: 409,
    jsonBody: {
      ok: false,
      code: 'ASSIGNMENT_NOT_ACTIVE',
      message: 'Assignment is not active.',
    },
  };
}

export const handler = async (request: HttpRequest, _context: InvocationContext) => {
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

  const access = await pool.request().input('id', sql.Int, id).query<SessionAccessRow>(`
      SELECT TOP 1
        p.id AS player_id,
        p.owner_token,
        pa.status AS assignment_status
      FROM game_sessions gs
      JOIN players p ON p.id = gs.player_id
      LEFT JOIN pack_assignments pa ON pa.id = gs.assignment_id
      WHERE gs.id = @id;
    `);
  const sessionAccess = access.recordset[0];

  if (!sessionAccess) {
    if (isPlayerTokenEnforcementEnabled()) {
      return {
        status: 401,
        jsonBody: { ok: false, message: 'Unauthorized' },
      };
    }
    return {
      status: 404,
      jsonBody: { ok: false, message: 'Session not found' },
    };
  }

  // When enforcement is on, the request token must hash to the owning
  // player's owner_token. We project owner_token in the same lookup so the
  // check costs no extra round-trip; the LEFT JOIN keeps the legacy null
  // case alive when the flag is off.
  if (isPlayerTokenEnforcementEnabled()) {
    const presentedToken = getPlayerTokenFromRequest(request);
    if (
      !(await verifyPlayerTokenForPlayer(pool, {
        playerId: sessionAccess.player_id,
        ownerTokenHash: sessionAccess.owner_token,
        presentedToken,
      }))
    ) {
      return {
        status: 401,
        jsonBody: { ok: false, message: 'Unauthorized' },
      };
    }
  }

  if (sessionAccess.assignment_status && sessionAccess.assignment_status !== 'active') {
    return assignmentNotActiveResponse();
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
