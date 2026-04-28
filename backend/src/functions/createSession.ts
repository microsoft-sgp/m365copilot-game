import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getPool } from '../lib/db.js';
import { isPackAssignmentLifecycleEnabled, resolvePackAssignment } from '../lib/packAssignments.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { isDuplicateSqlKeyError, numberValue, readJsonObject, stringValue } from './http.js';

async function upsertPlayer(
  pool: ConnectionPool,
  {
    sessionId,
    playerName,
    email,
    orgId = null,
  }: { sessionId: string; playerName: string; email?: string; orgId?: number | null },
) {
  const trimmedEmail = email ? email.trim().toLowerCase() : null;

  if (trimmedEmail) {
    const playerResult = await pool
      .request()
      .input('sessionId', sql.NVarChar(50), sessionId)
      .input('playerName', sql.NVarChar(200), playerName)
      .input('email', sql.NVarChar(320), trimmedEmail)
      .input('orgId', sql.Int, orgId).query(`
        MERGE players AS target
        USING (SELECT @email AS email) AS source
        ON target.email = source.email
        WHEN MATCHED THEN
          UPDATE SET session_id = @sessionId, org_id = COALESCE(target.org_id, @orgId)
        WHEN NOT MATCHED THEN
          INSERT (session_id, player_name, email, org_id) VALUES (@sessionId, @playerName, @email, @orgId)
        OUTPUT inserted.id;
      `);

    return { playerId: playerResult.recordset[0].id, trimmedEmail };
  }

  const playerResult = await pool
    .request()
    .input('sessionId', sql.NVarChar(50), sessionId)
    .input('playerName', sql.NVarChar(200), playerName).query(`
      MERGE players AS target
      USING (SELECT @sessionId AS session_id) AS source
      ON target.session_id = source.session_id
      WHEN MATCHED THEN
        UPDATE SET player_name = @playerName
      WHEN NOT MATCHED THEN
        INSERT (session_id, player_name) VALUES (@sessionId, @playerName)
      OUTPUT inserted.id;
    `);

  return { playerId: playerResult.recordset[0].id, trimmedEmail: null };
}

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const body = await readJsonObject(request);
  const sessionId = stringValue(body.sessionId);
  const playerName = stringValue(body.playerName);
  const packId = numberValue(body.packId);
  const email = stringValue(body.email);
  const organizationName = stringValue(body.organization || body.org).trim();
  const lifecycleEnabled = isPackAssignmentLifecycleEnabled();

  if (!sessionId || !playerName || (!lifecycleEnabled && packId == null)) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'sessionId, playerName, and packId are required.' },
    };
  }

  if (lifecycleEnabled && !email) {
    return {
      status: 400,
      jsonBody: {
        ok: false,
        message: 'email is required when pack assignment lifecycle is enabled.',
      },
    };
  }

  const pool = await getPool();
  let orgId: number | null = null;

  if (email) {
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

    orgId = resolvedOrganization.orgId;
  }

  const { playerId } = await upsertPlayer(pool, {
    sessionId,
    playerName,
    email,
    orgId,
  });

  if (lifecycleEnabled) {
    const assignmentResolution = await resolvePackAssignment({
      pool,
      playerId,
      context,
      allowRotation: true,
    });

    const assignment = assignmentResolution.assignment;
    if (!assignment) throw new Error('Pack assignment could not be resolved');

    const existingByAssignment = await pool
      .request()
      .input('assignmentId', sql.Int, assignment.assignmentId).query(`
        SELECT TOP 1 id
        FROM game_sessions
        WHERE assignment_id = @assignmentId
        ORDER BY last_active_at DESC, id DESC;
      `);

    if (existingByAssignment.recordset.length > 0) {
      return {
        jsonBody: {
          ok: true,
          gameSessionId: existingByAssignment.recordset[0].id,
          packId: assignment.packId,
          activeAssignment: {
            ...assignment,
            rotated: assignmentResolution.rotated,
            completedPackId: assignmentResolution.completedPackId,
          },
        },
      };
    }

    try {
      const sessionResult = await pool
        .request()
        .input('playerId', sql.Int, playerId)
        .input('packId', sql.Int, assignment.packId)
        .input('campaignId', sql.NVarChar(20), assignmentResolution.campaign.id)
        .input('assignmentId', sql.Int, assignment.assignmentId).query(`
          INSERT INTO game_sessions (player_id, pack_id, campaign_id, assignment_id)
          OUTPUT inserted.id
          VALUES (@playerId, @packId, @campaignId, @assignmentId);
        `);

      return {
        jsonBody: {
          ok: true,
          gameSessionId: sessionResult.recordset[0].id,
          packId: assignment.packId,
          activeAssignment: {
            ...assignment,
            rotated: assignmentResolution.rotated,
            completedPackId: assignmentResolution.completedPackId,
          },
        },
      };
    } catch (err) {
      if (isDuplicateSqlKeyError(err)) {
        const existing = await pool
          .request()
          .input('assignmentId', sql.Int, assignment.assignmentId).query(`
            SELECT TOP 1 id
            FROM game_sessions
            WHERE assignment_id = @assignmentId
            ORDER BY last_active_at DESC, id DESC;
          `);

        return {
          jsonBody: {
            ok: true,
            gameSessionId: existing.recordset[0].id,
            packId: assignment.packId,
            activeAssignment: {
              ...assignment,
              rotated: assignmentResolution.rotated,
              completedPackId: assignmentResolution.completedPackId,
            },
          },
        };
      }
      throw err;
    }
  }

  // Create game session (or return existing for same player+pack+campaign)
  try {
    const sessionResult = await pool
      .request()
      .input('playerId', sql.Int, playerId)
      .input('packId', sql.Int, packId).query(`
        INSERT INTO game_sessions (player_id, pack_id)
        OUTPUT inserted.id
        VALUES (@playerId, @packId);
      `);
    return {
      jsonBody: { ok: true, gameSessionId: sessionResult.recordset[0].id, packId },
    };
  } catch (err) {
    // Unique constraint violation — session already exists
    if (isDuplicateSqlKeyError(err)) {
      const existing = await pool
        .request()
        .input('playerId', sql.Int, playerId)
        .input('packId', sql.Int, packId).query(`
          SELECT id FROM game_sessions
          WHERE player_id = @playerId AND pack_id = @packId AND campaign_id = 'APR26';
        `);
      return {
        jsonBody: { ok: true, gameSessionId: existing.recordset[0].id, packId },
      };
    }
    throw err;
  }
};

app.http('createSession', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sessions',
  handler,
});
