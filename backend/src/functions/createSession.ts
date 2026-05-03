import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getPool } from '../lib/db.js';
import { isPackAssignmentLifecycleEnabled, resolvePackAssignment } from '../lib/packAssignments.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import {
  generatePlayerToken,
  getPlayerTokenFromRequest,
  hashPlayerToken,
  createPlayerDeviceToken,
  verifyPlayerTokenForPlayer,
} from '../lib/playerAuth.js';
import { createPlayerTokenCookie } from '../lib/playerCookies.js';
import { isDuplicateSqlKeyError, numberValue, readJsonObject, stringValue } from './http.js';

type ResolvedToken =
  | { kind: 'new'; token: string; hash: string }
  | { kind: 'reused'; token: string; hash?: string; persistDeviceToken?: boolean }
  | { kind: 'conflict' };

// Resolve the player session token for the email path before any session work.
// Returns the token to send back to the client (or `conflict` to short-circuit
// with HTTP 409). The hash is only carried for the `new` path so the INSERT in
// upsertPlayer can stamp it without re-reading the row.
async function resolvePlayerToken(
  pool: ConnectionPool,
  trimmedEmail: string,
  presentedToken: string,
): Promise<ResolvedToken> {
  const existing = await pool.request().input('email', sql.NVarChar(320), trimmedEmail).query<{
    id: number;
    owner_token: string | null;
  }>('SELECT id, owner_token FROM players WHERE email = @email;');
  const row = existing.recordset[0];

  if (!row) {
    // Brand-new player. Generate a token now so upsertPlayer can write the hash
    // in the same INSERT and we don't roundtrip the row twice.
    const token = generatePlayerToken();
    return { kind: 'new', token, hash: hashPlayerToken(token) };
  }

  if (row.owner_token) {
    // Existing player who already claimed their identity. Reject anything other
    // than the matching token to prevent silent takeover via the email-keyed
    // MERGE that this endpoint historically allowed.
    if (
      await verifyPlayerTokenForPlayer(pool, {
        playerId: row.id,
        ownerTokenHash: row.owner_token,
        presentedToken,
      })
    ) {
      return { kind: 'reused', token: presentedToken };
    }
    return { kind: 'conflict' };
  }

  // Legacy player row created before this change. Claim it atomically — first
  // device to call wins. The WHERE-clause guard makes this safe under races
  // because another concurrent claim sees rowsAffected = 0 and falls through
  // to the conflict path below.
  const newToken = generatePlayerToken();
  const newHash = hashPlayerToken(newToken);
  const claim = await pool
    .request()
    .input('id', sql.Int, row.id)
    .input('hash', sql.NVarChar(64), newHash)
    .query('UPDATE players SET owner_token = @hash WHERE id = @id AND owner_token IS NULL;');

  if (claim.rowsAffected[0] === 1) {
    return { kind: 'reused', token: newToken, hash: newHash, persistDeviceToken: true };
  }

  // Race lost between SELECT and UPDATE. Re-fetch and verify the presented
  // token; if it matches the racer who won, we honour it. Otherwise treat as
  // conflict so the legitimate owner can recover via admin reset.
  const refetched = await pool
    .request()
    .input('email', sql.NVarChar(320), trimmedEmail)
    .query<{ owner_token: string | null }>('SELECT owner_token FROM players WHERE email = @email;');
  const winnerHash = refetched.recordset[0]?.owner_token ?? null;
  if (
    await verifyPlayerTokenForPlayer(pool, {
      playerId: row.id,
      ownerTokenHash: winnerHash,
      presentedToken,
    })
  ) {
    return { kind: 'reused', token: presentedToken };
  }
  return { kind: 'conflict' };
}

async function upsertPlayer(
  pool: ConnectionPool,
  {
    sessionId,
    playerName,
    email,
    orgId = null,
    ownerTokenHashForInsert = null,
  }: {
    sessionId: string;
    playerName: string;
    email?: string;
    orgId?: number | null;
    // Only stamped on the INSERT path. The MERGE leaves owner_token alone on
    // MATCH because resolvePlayerToken has already verified or claimed it.
    ownerTokenHashForInsert?: string | null;
  },
) {
  const trimmedEmail = email ? email.trim().toLowerCase() : null;

  if (trimmedEmail) {
    const playerResult = await pool
      .request()
      .input('sessionId', sql.NVarChar(50), sessionId)
      .input('playerName', sql.NVarChar(200), playerName)
      .input('email', sql.NVarChar(320), trimmedEmail)
      .input('orgId', sql.Int, orgId)
      .input('ownerTokenHash', sql.NVarChar(64), ownerTokenHashForInsert).query(`
        MERGE players AS target
        USING (SELECT @email AS email) AS source
        ON target.email = source.email
        WHEN MATCHED THEN
          UPDATE SET session_id = @sessionId, org_id = COALESCE(target.org_id, @orgId)
        WHEN NOT MATCHED THEN
          INSERT (session_id, player_name, email, org_id, owner_token)
          VALUES (@sessionId, @playerName, @email, @orgId, @ownerTokenHash)
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

  // Resolve / issue / claim the player session token before touching the row.
  // The non-email legacy path keeps no token; lifecycle-enabled deployments
  // always go through the email path.
  const trimmedEmail = email ? email.trim().toLowerCase() : '';
  let resolvedToken: ResolvedToken | null = null;
  if (trimmedEmail) {
    const presentedToken = getPlayerTokenFromRequest(request);
    resolvedToken = await resolvePlayerToken(pool, trimmedEmail, presentedToken);
    if (resolvedToken.kind === 'conflict') {
      return {
        status: 409,
        jsonBody: { ok: false, code: 'PLAYER_RECOVERY_REQUIRED', message: 'Identity in use' },
      };
    }
  }

  const ownerTokenHashForInsert = resolvedToken?.kind === 'new' ? resolvedToken.hash : null;

  const { playerId } = await upsertPlayer(pool, {
    sessionId,
    playerName,
    email,
    orgId,
    ownerTokenHashForInsert,
  });

  if (resolvedToken?.kind === 'new') {
    await createPlayerDeviceToken(pool, playerId, resolvedToken.hash);
  } else if (
    resolvedToken?.kind === 'reused' &&
    resolvedToken.persistDeviceToken &&
    resolvedToken.hash
  ) {
    await createPlayerDeviceToken(pool, playerId, resolvedToken.hash);
  }

  // Helper: every successful return path includes the token in the body and
  // sets the HttpOnly cookie. Non-email legacy path (no token) returns as-is.
  type SuccessResponse = {
    jsonBody: Record<string, unknown>;
    cookies?: ReturnType<typeof createPlayerTokenCookie>[];
  };
  const augment = (response: SuccessResponse): SuccessResponse => {
    if (!resolvedToken) return response;
    return {
      ...response,
      jsonBody: { ...response.jsonBody, playerToken: resolvedToken.token },
      cookies: [createPlayerTokenCookie(resolvedToken.token)],
    };
  };

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
      return augment({
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
      });
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

      return augment({
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
      });
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

        return augment({
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
        });
      }
      throw err;
    }
  }

  // Legacy non-lifecycle path: create or return the existing session for
  // (player, pack, campaign).
  try {
    const sessionResult = await pool
      .request()
      .input('playerId', sql.Int, playerId)
      .input('packId', sql.Int, packId).query(`
        INSERT INTO game_sessions (player_id, pack_id)
        OUTPUT inserted.id
        VALUES (@playerId, @packId);
      `);
    return augment({
      jsonBody: { ok: true, gameSessionId: sessionResult.recordset[0].id, packId },
    });
  } catch (err) {
    if (isDuplicateSqlKeyError(err)) {
      const existing = await pool
        .request()
        .input('playerId', sql.Int, playerId)
        .input('packId', sql.Int, packId).query(`
          SELECT id FROM game_sessions
          WHERE player_id = @playerId AND pack_id = @packId AND campaign_id = 'APR26';
        `);
      return augment({
        jsonBody: { ok: true, gameSessionId: existing.recordset[0].id, packId },
      });
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
