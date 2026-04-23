import { app } from '@azure/functions';
import sql from 'mssql';
import { getPool } from '../lib/db.js';
import { validateKeywordFormat } from '../lib/validation.js';

export const handler = async (request, context) => {
    const body = await request.json();
    const org = (body.org || '').trim();
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const keyword = (body.keyword || '').trim().toUpperCase();

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

    // Resolve org from email domain via org_domains, fall back to manual org name
    const domain = email.split('@')[1];
    let orgId;

    const domainLookup = await pool
      .request()
      .input('domain', sql.NVarChar(255), domain)
      .query(`
        SELECT o.id FROM org_domains od
        JOIN organizations o ON o.id = od.org_id
        WHERE od.domain = @domain;
      `);

    if (domainLookup.recordset.length > 0) {
      orgId = domainLookup.recordset[0].id;
    } else {
      // Upsert organization by name
      const orgResult = await pool
        .request()
        .input('orgName', sql.NVarChar(100), org)
        .query(`
          MERGE organizations AS target
          USING (SELECT @orgName AS name) AS source
          ON target.name = source.name
          WHEN NOT MATCHED THEN
            INSERT (name) VALUES (@orgName)
          OUTPUT inserted.id;
        `);
      if (orgResult.recordset.length > 0) {
        orgId = orgResult.recordset[0].id;
      } else {
        // MERGE matched but didn't output — fetch existing
        const existing = await pool
          .request()
          .input('orgName', sql.NVarChar(100), org)
          .query('SELECT id FROM organizations WHERE name = @orgName;');
        orgId = existing.recordset[0].id;
      }
    }

    // Upsert player by email (for submissions, email is the identity)
    const playerResult = await pool
      .request()
      .input('email', sql.NVarChar(320), email)
      .input('playerName', sql.NVarChar(200), name)
      .query(`
        MERGE players AS target
        USING (SELECT @email AS email) AS source
        ON target.email = source.email
        WHEN MATCHED THEN
          UPDATE SET player_name = @playerName
        WHEN NOT MATCHED THEN
          INSERT (session_id, player_name, email) VALUES (NEWID(), @playerName, @email)
        OUTPUT inserted.id;
      `);
    let playerId;
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
        .input('keyword', sql.NVarChar(100), keyword)
        .query(`
          INSERT INTO submissions (player_id, org_id, keyword)
          VALUES (@playerId, @orgId, @keyword);
        `);
    } catch (err) {
      if (err.number === 2627 || err.number === 2601) {
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
      .input('playerId', sql.Int, playerId)
      .query(`
        SELECT COUNT(*) AS cnt FROM submissions
        WHERE org_id = @orgId AND keyword = @keyword AND player_id != @playerId;
      `);
    const orgDupe = orgDupeCheck.recordset[0].cnt > 0;

    const resolvedOrg = org;
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
