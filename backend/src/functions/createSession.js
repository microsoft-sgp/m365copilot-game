import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';

export const handler = async (request, context) => {
  const body = await request.json();
  const { sessionId, playerName, packId, email } = body;

  if (!sessionId || !playerName || packId == null) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'sessionId, playerName, and packId are required.' },
    };
  }

  const pool = await getPool();
  const trimmedEmail = email ? email.trim().toLowerCase() : null;

  // Upsert player: prefer email as identity, fall back to sessionId
  let playerResult;
  if (trimmedEmail) {
    playerResult = await pool
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
  } else {
    playerResult = await pool
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
  }
  const playerId = playerResult.recordset[0].id;

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
      jsonBody: { ok: true, gameSessionId: sessionResult.recordset[0].id },
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
        jsonBody: { ok: true, gameSessionId: existing.recordset[0].id },
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
