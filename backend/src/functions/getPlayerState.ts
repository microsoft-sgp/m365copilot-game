import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { isPackAssignmentLifecycleEnabled, resolvePackAssignment } from '../lib/packAssignments.js';

type SessionRecord = {
  id: number;
  pack_id: number;
  campaign_id: string;
  tiles_cleared: number;
  lines_won: number;
  keywords_earned: number;
  board_state: string | null;
  started_at: Date | string;
  last_active_at: Date | string;
};

function mapSessionRecord(s: SessionRecord | undefined) {
  if (!s) return null;
  return {
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

export const handler = async (request: HttpRequest, context: InvocationContext) => {
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
    .input('email', sql.NVarChar(320), email.trim().toLowerCase()).query(`
      SELECT p.id, p.player_name, p.session_id, p.org_id, o.name AS org_name
      FROM players p
      LEFT JOIN organizations o ON o.id = p.org_id
      WHERE p.email = @email;
    `);

  if (playerResult.recordset.length === 0) {
    return {
      jsonBody: { ok: true, player: null },
    };
  }

  const player = playerResult.recordset[0];
  const lifecycleEnabled = isPackAssignmentLifecycleEnabled();

  if (lifecycleEnabled) {
    const assignmentResolution = await resolvePackAssignment({
      pool,
      playerId: player.id,
      context,
      allowRotation: true,
    });

    const assignment = assignmentResolution.assignment;
    if (!assignment) throw new Error('Pack assignment could not be resolved');

    const sessionResult = await pool
      .request()
      .input('assignmentId', sql.Int, assignment.assignmentId).query(`
        SELECT TOP 1
          id, pack_id, campaign_id, tiles_cleared, lines_won,
          keywords_earned, board_state, started_at, last_active_at
        FROM game_sessions
        WHERE assignment_id = @assignmentId
        ORDER BY last_active_at DESC, id DESC;
      `);

    const activeSession = mapSessionRecord(sessionResult.recordset[0] as SessionRecord | undefined);

    return {
      jsonBody: {
        ok: true,
        player: {
          playerName: player.player_name,
          sessionId: player.session_id,
          organization: player.org_id ? { id: player.org_id, name: player.org_name } : null,
          activeAssignment: {
            ...assignment,
            rotated: assignmentResolution.rotated,
            completedPackId: assignmentResolution.completedPackId,
            totalWeeks: assignmentResolution.campaign.totalWeeks,
          },
          activeSession,
        },
      },
    };
  }

  // Get most recent active session with board state
  const sessionResult = await pool.request().input('playerId', sql.Int, player.id).query(`
      SELECT TOP 1
        id, pack_id, campaign_id, tiles_cleared, lines_won,
        keywords_earned, board_state, started_at, last_active_at
      FROM game_sessions
      WHERE player_id = @playerId
      ORDER BY last_active_at DESC;
    `);

  const activeSession = mapSessionRecord(sessionResult.recordset[0] as SessionRecord | undefined);

  return {
    jsonBody: {
      ok: true,
      player: {
        playerName: player.player_name,
        sessionId: player.session_id,
        organization: player.org_id ? { id: player.org_id, name: player.org_name } : null,
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
