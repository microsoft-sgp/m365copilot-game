import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getPool } from '../lib/db.js';
import { rerollPackAssignment } from '../lib/packAssignments.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import {
  getPlayerTokenFromRequest,
  isPlayerTokenEnforcementEnabled,
  verifyPlayerTokenForPlayer,
} from '../lib/playerAuth.js';
import { isDuplicateSqlKeyError, numberValue, readJsonObject, stringValue } from './http.js';

type PlayerRow = {
  id: number;
  owner_token: string | null;
};

type AssignmentSessionRow = {
  id: number;
};

async function resolveExpectedAssignmentId(
  pool: ConnectionPool,
  gameSessionId: number | null | undefined,
  playerId: number,
): Promise<number | null> {
  if (!gameSessionId) return null;

  const session = await pool
    .request()
    .input('gameSessionId', sql.Int, gameSessionId)
    .input('playerId', sql.Int, playerId).query<{ assignment_id: number | null }>(`
      SELECT TOP 1 assignment_id
      FROM game_sessions
      WHERE id = @gameSessionId
        AND player_id = @playerId;
    `);

  return session.recordset[0]?.assignment_id ?? null;
}

async function resolveGameSessionForAssignment(
  pool: ConnectionPool,
  {
    playerId,
    campaignId,
    packId,
    assignmentId,
  }: {
    playerId: number;
    campaignId: string;
    packId: number;
    assignmentId: number;
  },
): Promise<number> {
  const existing = await pool.request().input('assignmentId', sql.Int, assignmentId)
    .query<AssignmentSessionRow>(`
      SELECT TOP 1 id
      FROM game_sessions
      WHERE assignment_id = @assignmentId
      ORDER BY last_active_at DESC, id DESC;
    `);

  if (existing.recordset[0]) return existing.recordset[0].id;

  try {
    const inserted = await pool
      .request()
      .input('playerId', sql.Int, playerId)
      .input('packId', sql.Int, packId)
      .input('campaignId', sql.NVarChar(20), campaignId)
      .input('assignmentId', sql.Int, assignmentId).query<AssignmentSessionRow>(`
        INSERT INTO game_sessions (player_id, pack_id, campaign_id, assignment_id)
        OUTPUT inserted.id
        VALUES (@playerId, @packId, @campaignId, @assignmentId);
      `);
    return inserted.recordset[0].id;
  } catch (err) {
    if (!isDuplicateSqlKeyError(err)) throw err;
    const raced = await pool.request().input('assignmentId', sql.Int, assignmentId)
      .query<AssignmentSessionRow>(`
        SELECT TOP 1 id
        FROM game_sessions
        WHERE assignment_id = @assignmentId
        ORDER BY last_active_at DESC, id DESC;
      `);
    return raced.recordset[0].id;
  }
}

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const body = await readJsonObject(request);
  const email = stringValue(body.email).trim().toLowerCase();
  const playerName = stringValue(body.playerName);
  const organizationName = stringValue(body.organization || body.org).trim();
  const gameSessionId = numberValue(body.gameSessionId);

  if (!email || !playerName) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'email and playerName are required.' },
    };
  }

  const pool = await getPool();
  const resolvedOrganization = await resolveOrganizationForEmail(pool, {
    email,
    organizationName,
  });

  if (resolvedOrganization.requiresOrganization) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'organization is required for public email domains.' },
    };
  }

  const playerResult = await pool.request().input('email', sql.NVarChar(320), email)
    .query<PlayerRow>(`
      SELECT id, owner_token
      FROM players
      WHERE email = @email;
    `);
  const player = playerResult.recordset[0];

  if (!player) {
    return {
      status: 404,
      jsonBody: { ok: false, message: 'Player not found' },
    };
  }

  if (isPlayerTokenEnforcementEnabled() || player.owner_token) {
    const presentedToken = getPlayerTokenFromRequest(request);
    if (
      !(await verifyPlayerTokenForPlayer(pool, {
        playerId: player.id,
        ownerTokenHash: player.owner_token,
        presentedToken,
      }))
    ) {
      return {
        status: 409,
        jsonBody: { ok: false, code: 'PLAYER_RECOVERY_REQUIRED', message: 'Identity in use' },
      };
    }
  }

  if (resolvedOrganization.orgId) {
    await pool
      .request()
      .input('playerId', sql.Int, player.id)
      .input('orgId', sql.Int, resolvedOrganization.orgId)
      .query('UPDATE players SET org_id = COALESCE(org_id, @orgId) WHERE id = @playerId;');
  }

  const expectedAssignmentId = await resolveExpectedAssignmentId(pool, gameSessionId, player.id);
  const assignmentResolution = await rerollPackAssignment({
    pool,
    playerId: player.id,
    context,
    expectedAssignmentId,
  });

  const assignment = assignmentResolution.assignment;
  if (!assignment) throw new Error('Pack assignment could not be rerolled');

  const resolvedGameSessionId = await resolveGameSessionForAssignment(pool, {
    playerId: player.id,
    campaignId: assignment.campaignId,
    packId: assignment.packId,
    assignmentId: assignment.assignmentId,
  });

  return {
    jsonBody: {
      ok: true,
      gameSessionId: resolvedGameSessionId,
      packId: assignment.packId,
      activeAssignment: {
        ...assignment,
        rerolled: assignmentResolution.rerolled,
        abandonedAssignment: assignmentResolution.abandonedAssignment,
      },
    },
  };
};

app.http('rerollAssignment', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'player/assignment/reroll',
  handler,
});
