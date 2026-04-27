import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { verifyAdmin } from '../lib/adminAuth.js';

async function searchPlayers(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const q = request.query.get('q') || '';
  const pool = await getPool();

  const result = await pool.request()
    .input('q', sql.NVarChar(320), `%${q}%`)
    .query(`
      SELECT TOP 50 p.id, p.player_name, p.email, p.created_at,
        (SELECT COUNT(*) FROM game_sessions gs WHERE gs.player_id = p.id) AS session_count,
        (SELECT COUNT(*) FROM submissions s WHERE s.player_id = p.id) AS submission_count
      FROM players p
      WHERE p.email LIKE @q OR p.player_name LIKE @q
      ORDER BY p.created_at DESC;
    `);

  return { jsonBody: { players: result.recordset } };
}

async function getPlayerDetail(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid player id' } };
  }

  const pool = await getPool();

  const player = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT id, session_id, player_name, email, created_at FROM players WHERE id = @id;');

  if (player.recordset.length === 0) {
    return { status: 404, jsonBody: { ok: false, message: 'Player not found' } };
  }

  const sessions = await pool.request()
    .input('playerId', sql.Int, id)
    .query(`
      SELECT id, pack_id, campaign_id, tiles_cleared, lines_won, keywords_earned, started_at, last_active_at
      FROM game_sessions WHERE player_id = @playerId ORDER BY last_active_at DESC;
    `);

  const submissions = await pool.request()
    .input('playerId', sql.Int, id)
    .query(`
      SELECT s.id, o.name AS org, s.keyword, s.campaign_id, s.created_at
      FROM submissions s JOIN organizations o ON s.org_id = o.id
      WHERE s.player_id = @playerId ORDER BY s.created_at DESC;
    `);

  return {
    jsonBody: {
      player: player.recordset[0],
      sessions: sessions.recordset,
      submissions: submissions.recordset,
    },
  };
}

async function deletePlayer(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid player id' } };
  }

  const pool = await getPool();

  // Cascade: tile_events → game_sessions → submissions → player
  await pool.request().input('playerId', sql.Int, id).query(`
    DELETE te FROM tile_events te
    INNER JOIN game_sessions gs ON te.game_session_id = gs.id
    WHERE gs.player_id = @playerId;
  `);
  await pool.request().input('playerId', sql.Int, id).query('DELETE FROM game_sessions WHERE player_id = @playerId;');
  await pool.request().input('playerId', sql.Int, id).query('DELETE FROM submissions WHERE player_id = @playerId;');
  await pool.request().input('id', sql.Int, id).query('DELETE FROM players WHERE id = @id;');

  return { jsonBody: { ok: true } };
}

async function revokeSubmission(request, context) {
  const auth = verifyAdmin(request);
  if (!auth.ok) return auth.response;

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    return { status: 400, jsonBody: { ok: false, message: 'Invalid submission id' } };
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM submissions WHERE id = @id;');

  if (result.rowsAffected[0] === 0) {
    return { status: 404, jsonBody: { ok: false, message: 'Submission not found' } };
  }

  return { jsonBody: { ok: true } };
}

app.http('adminSearchPlayers', { methods: ['GET'], authLevel: 'anonymous', route: 'portal-api/players', handler: searchPlayers });
app.http('adminGetPlayerDetail', { methods: ['GET'], authLevel: 'anonymous', route: 'portal-api/players/{id}', handler: getPlayerDetail });
app.http('adminDeletePlayer', { methods: ['DELETE'], authLevel: 'anonymous', route: 'portal-api/players/{id}', handler: deletePlayer });
app.http('adminRevokeSubmission', { methods: ['DELETE'], authLevel: 'anonymous', route: 'portal-api/submissions/{id}', handler: revokeSubmission });

export {
  searchPlayers,
  getPlayerDetail,
  deletePlayer,
  revokeSubmission,
};
