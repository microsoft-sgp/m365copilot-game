import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';

export const handler = async (request, context) => {
  const email = request.query.get('email');
  if (!email) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Email is required' },
    };
  }

  const pool = await getPool();

  // Find player by email
  const playerResult = await pool
    .request()
    .input('email', sql.NVarChar(320), email.trim().toLowerCase())
    .query('SELECT id, player_name, session_id FROM players WHERE email = @email;');

  if (playerResult.recordset.length === 0) {
    return {
      jsonBody: { ok: true, player: null },
    };
  }

  const player = playerResult.recordset[0];

  // Get most recent active session with board state
  const sessionResult = await pool
    .request()
    .input('playerId', sql.Int, player.id)
    .query(`
      SELECT TOP 1
        id, pack_id, campaign_id, tiles_cleared, lines_won,
        keywords_earned, board_state, started_at, last_active_at
      FROM game_sessions
      WHERE player_id = @playerId
      ORDER BY last_active_at DESC;
    `);

  let activeSession = null;
  if (sessionResult.recordset.length > 0) {
    const s = sessionResult.recordset[0];
    activeSession = {
      gameSessionId: s.id,
      packId: s.pack_id,
      campaignId: s.campaign_id,
      tilesCleared: s.tiles_cleared,
      linesWon: s.lines_won,
      keywordsEarned: s.keywords_earned,
      boardState: s.board_state ? JSON.parse(s.board_state) : null,
      startedAt: s.started_at,
      lastActiveAt: s.last_active_at,
    };
  }

  return {
    jsonBody: {
      ok: true,
      player: {
        playerName: player.player_name,
        sessionId: player.session_id,
        activeSession,
      },
    },
  };
};

app.http('getPlayerState', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'player/state',
  handler,
});
