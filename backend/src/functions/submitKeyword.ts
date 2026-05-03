import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { validateKeywordFormat } from '../lib/validation.js';
import { resolveOrganizationForEmail } from '../lib/organizations.js';
import { getDefaultCampaignId, invalidateLeaderboardCache } from '../lib/cache.js';
import {
  getPlayerTokenFromRequest,
  isPlayerTokenEnforcementEnabled,
  verifyPlayerTokenForPlayer,
} from '../lib/playerAuth.js';
import { isDuplicateSqlKeyError, readJsonObject, stringValue } from './http.js';

export const handler = async (request: HttpRequest, context: InvocationContext) => {
  const body = await readJsonObject(request);
  const org = stringValue(body.org).trim();
  const name = stringValue(body.name).trim();
  const email = stringValue(body.email).trim().toLowerCase();
  const keyword = stringValue(body.keyword).trim().toUpperCase();

  if (!org || !name || !email || !keyword) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'All fields are required.' },
    };
  }
  if (!email.includes('@')) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Invalid email.' },
    };
  }
  if (!validateKeywordFormat(keyword)) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Invalid keyword format.' },
    };
  }

  const pool = await getPool();

  // Token enforcement: if a player row exists for this email, the request
  // MUST present a token whose hash matches owner_token. A non-existent row
  // is allowed to fall through (the upsert below creates one with null token,
  // which will be claimed on the next createSession call). This keeps a fresh
  // player able to submit on devices that haven't called createSession yet,
  // while preventing impersonation of an established player.
  if (isPlayerTokenEnforcementEnabled()) {
    const lookup = await pool.request().input('email', sql.NVarChar(320), email).query<{
      id: number;
      owner_token: string | null;
    }>('SELECT TOP 1 id, owner_token FROM players WHERE email = @email;');
    const existingPlayer = lookup.recordset[0];
    if (existingPlayer?.owner_token) {
      const presentedToken = getPlayerTokenFromRequest(request);
      if (
        !(await verifyPlayerTokenForPlayer(pool, {
          playerId: existingPlayer.id,
          ownerTokenHash: existingPlayer.owner_token,
          presentedToken,
        }))
      ) {
        return {
          status: 401,
          jsonBody: { ok: false, message: 'Unauthorized' },
        };
      }
    }
  }

  const resolvedOrganization = await resolveOrganizationForEmail(pool, {
    email,
    organizationName: org,
  });

  if (!resolvedOrganization.orgId) {
    return {
      status: 400,
      jsonBody: { ok: false, message: 'Could not resolve organization.' },
    };
  }
  const orgId = resolvedOrganization.orgId;

  // Upsert player by email (for submissions, email is the identity)
  const playerResult = await pool
    .request()
    .input('email', sql.NVarChar(320), email)
    .input('playerName', sql.NVarChar(200), name)
    .input('orgId', sql.Int, orgId).query(`
        MERGE players AS target
        USING (SELECT @email AS email) AS source
        ON target.email = source.email
        WHEN MATCHED THEN
          UPDATE SET player_name = @playerName, org_id = COALESCE(target.org_id, @orgId)
        WHEN NOT MATCHED THEN
          INSERT (session_id, player_name, email, org_id) VALUES (NEWID(), @playerName, @email, @orgId)
        OUTPUT inserted.id;
      `);
  let playerId: number;
  if (playerResult.recordset.length > 0) {
    playerId = playerResult.recordset[0].id;
  } else {
    const existing = await pool
      .request()
      .input('email', sql.NVarChar(320), email)
      .query('SELECT id FROM players WHERE email = @email;');
    playerId = existing.recordset[0].id;
  }

  // Insert submission (unique constraint on player_id + keyword)
  try {
    await pool
      .request()
      .input('playerId', sql.Int, playerId)
      .input('orgId', sql.Int, orgId)
      .input('keyword', sql.NVarChar(100), keyword).query(`
          INSERT INTO submissions (player_id, org_id, keyword)
          VALUES (@playerId, @orgId, @keyword);
        `);
  } catch (err) {
    if (isDuplicateSqlKeyError(err)) {
      return {
        status: 409,
        jsonBody: { ok: false, message: 'You have already submitted this keyword.' },
      };
    }
    throw err;
  }

  // Check if this keyword was already submitted by another player in the same org
  const orgDupeCheck = await pool
    .request()
    .input('orgId', sql.Int, orgId)
    .input('keyword', sql.NVarChar(100), keyword)
    .input('playerId', sql.Int, playerId).query(`
        SELECT COUNT(*) AS cnt FROM submissions
        WHERE org_id = @orgId AND keyword = @keyword AND player_id != @playerId;
      `);
  const orgDupe = orgDupeCheck.recordset[0].cnt > 0;
  await invalidateLeaderboardCache(getDefaultCampaignId(), context);

  const resolvedOrg = resolvedOrganization.orgName || org;
  return {
    jsonBody: {
      ok: true,
      orgDupe,
      message: orgDupe
        ? `Submitted! Note: this keyword was already counted for ${resolvedOrg}, so org score won't increase.`
        : `Keyword accepted for ${resolvedOrg}! Leaderboard updated.`,
    },
  };
};

app.http('submitKeyword', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'submissions',
  handler,
});
