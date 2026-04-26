import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import {
  isPackAssignmentLifecycleEnabled,
  resolvePackAssignment,
} from '../lib/packAssignments.js';

async function upsertPlayer(pool, { sessionId, playerName, email }) {
  const trimmedEmail = email ? email.trim().toLowerCase() : null;

  if (trimmedEmail) {
    const playerResult = await pool
      .request()
      .input('sessionId', sql.NVarChar(50), sessionId)
      .input('playerName', sql.NVarChar(200), playerName)
      .input('email', sql.NVarChar(320), trimmedEmail)
      .query(`
        MERGE players AS target
        USING (SELECT @email AS email) AS source
        ON target.email = source.email
        WHEN MATCHED THEN
          UPDATE SET session_id = @sessionId
        WHEN NOT MATCHED THEN
          INSERT (session_id, player_name, email) VALUES (@sessionId, @playerName, @email)
        OUTPUT inserted.id;
      `);

    return { playerId: playerResult.recordset[0].id, trimmedEmail };
  }

  const playerResult = await pool
    .request()
    .input('sessionId', sql.NVarChar(50), sessionId)
    .input('playerName', sql.NVarChar(200), playerName)
    .query(`
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

export const handler = async (request, context) => {
  const body = await request.json();
  const { sessionId, playerName, packId, email } = body;
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
      jsonBody: { ok: false, message: 'email is required when pack assignment lifecycle is enabled.' },
    };
  }

  const pool = await getPool();
  const { playerId } = await upsertPlayer(pool, { sessionId, playerName, email });

  if (lifecycleEnabled) {
    const assignmentResolution = await resolvePackAssignment({
      pool,
      playerId,
      context,
      allowRotation: true,
    });

    const assignment = assignmentResolution.assignment;

    const existingByAssignment = await pool
      .request()
      .input('assignmentId', sql.Int, assignment.assignmentId)
      .query(`
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
        .input('assignmentId', sql.Int, assignment.assignmentId)
        .query(`
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
      if (err.number === 2627 || err.number === 2601) {
        const existing = await pool
          .request()
          .input('assignmentId', sql.Int, assignment.assignmentId)
          .query(`
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
      .input('packId', sql.Int, packId)
      .query(`
        INSERT INTO game_sessions (player_id, pack_id)
        OUTPUT inserted.id
        VALUES (@playerId, @packId);
      `);
    return {
      jsonBody: { ok: true, gameSessionId: sessionResult.recordset[0].id, packId },
    };
  } catch (err) {
    // Unique constraint violation — session already exists
    if (err.number === 2627 || err.number === 2601) {
      const existing = await pool
        .request()
        .input('playerId', sql.Int, playerId)
        .input('packId', sql.Int, packId)
        .query(`
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
