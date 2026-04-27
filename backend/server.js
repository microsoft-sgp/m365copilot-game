// Lightweight Express wrapper that loads Azure Functions handlers
// for local Docker testing. Not used in production (Azure Functions runtime).
import express from 'express';
import { getPool } from './src/lib/db.js';

const app = express();
app.use(express.json());

// CORS for frontend — restrict to explicitly allowed origins in production
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (allowedOrigins.length === 0) {
    // Dev fallback: allow all (no CORS_ORIGINS configured)
    res.header('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Adapter: convert Express req/res to Azure Functions request/response shapes
function adapt(handlerModule) {
  return async (req, res) => {
    try {
      const mod = typeof handlerModule === 'function' ? { handler: handlerModule } : handlerModule;
      const handler = mod.handler || mod.default;

      const fakeRequest = {
        json: async () => req.body,
        params: req.params,
        query: { get: (k) => req.query[k] || null },
        headers: { get: (k) => req.headers[k.toLowerCase()] || null },
      };

      const result = await handler(fakeRequest, { log: console.log });

      if (result.headers) {
        Object.entries(result.headers).forEach(([k, v]) => res.set(k, v));
      }
      if (result.body && !result.jsonBody) {
        res.status(result.status || 200).send(result.body);
      } else {
        res.status(result.status || 200).json(result.jsonBody);
      }
    } catch (err) {
      console.error('Handler error:', err);
      res.status(500).json({ ok: false, message: 'Internal server error' });
    }
  };
}

// Import all handlers
const { handler: createSession } = await import('./src/functions/createSession.js');
const { handler: updateSession } = await import('./src/functions/updateSession.js');
const { handler: recordEvent } = await import('./src/functions/recordEvent.js');
const { handler: submitKeyword } = await import('./src/functions/submitKeyword.js');
const { handler: getLeaderboard } = await import('./src/functions/getLeaderboard.js');
const { handler: adminDashboard } = await import('./src/functions/adminDashboard.js');
const { handler: exportCsv } = await import('./src/functions/exportCsv.js');
const { handler: getActiveCampaign } = await import('./src/functions/getActiveCampaign.js');
const { handler: getOrgDomains } = await import('./src/functions/getOrgDomains.js');
const { handler: getPlayerState } = await import('./src/functions/getPlayerState.js');
const { handler: requestOtp } = await import('./src/functions/requestOtp.js');
const { handler: verifyOtp } = await import('./src/functions/verifyOtp.js');
const { handler: health } = await import('./src/functions/health.js');

// Admin org/campaign/player handlers are registered differently (multiple per file)
// Import the modules to trigger app.http registrations, but we'll route manually
const adminOrgs = await import('./src/functions/adminOrganizations.js');
const adminCampaigns = await import('./src/functions/adminCampaigns.js');
const adminPlayers = await import('./src/functions/adminPlayers.js');

// Public routes
app.get('/api/health', adapt({ handler: health }));
app.post('/api/sessions', adapt({ handler: createSession }));
app.patch('/api/sessions/:id', adapt({ handler: updateSession }));
app.post('/api/events', adapt({ handler: recordEvent }));
app.post('/api/submissions', adapt({ handler: submitKeyword }));
app.get('/api/leaderboard', adapt({ handler: getLeaderboard }));
app.get('/api/campaigns/active', adapt({ handler: getActiveCampaign }));
app.get('/api/organizations/domains', adapt({ handler: getOrgDomains }));
app.get('/api/player/state', adapt({ handler: getPlayerState }));

// Admin auth
app.post('/api/portal-api/request-otp', adapt({ handler: requestOtp }));
app.post('/api/portal-api/verify-otp', adapt({ handler: verifyOtp }));

// Admin dashboard & export
app.get('/api/portal-api/dashboard', adapt({ handler: adminDashboard }));
app.get('/api/portal-api/export', adapt({ handler: exportCsv }));

// We need to extract the individual handlers from the multi-handler files
// Since they use app.http() which is Azure Functions specific, we'll re-implement routing
// by importing from the source directly

// For multi-handler files, create inline adapters that call the right function
async function createMultiHandlerAdapter(modulePath) {
  const mod = await import(modulePath);
  return mod;
}

// Admin Organizations — extract handlers by re-reading the module
// The handlers are registered via app.http() but we need direct access
// Let's create a simple proxy approach
async function adminOrgHandler(method, hasId, hasDomainId) {
  const { verifyAdmin } = await import('./src/lib/adminAuth.js');
  const sql = (await import('mssql')).default;
  
  return async (req, res) => {
    try {
      const fakeRequest = {
        json: async () => req.body,
        params: req.params,
        query: { get: (k) => req.query[k] || null },
        headers: { get: (k) => req.headers[k.toLowerCase()] || null },
      };

      const auth = verifyAdmin(fakeRequest);
      if (!auth.ok) return res.status(auth.response.status).json(auth.response.jsonBody);

      const pool = await getPool();
      
      if (method === 'GET' && !hasId) {
        // List orgs
        const result = await pool.request().query(`
          SELECT o.id, o.name,
            (SELECT od.id, od.domain FROM org_domains od WHERE od.org_id = o.id FOR JSON PATH) AS domains
          FROM organizations o ORDER BY o.name;
        `);
        return res.json({ organizations: result.recordset.map(o => ({ id: o.id, name: o.name, domains: o.domains ? JSON.parse(o.domains) : [] })) });
      }
      if (method === 'POST' && !hasId) {
        // Create org
        const name = (req.body.name || '').trim();
        if (!name) return res.status(400).json({ ok: false, message: 'Name is required' });
        try {
          const result = await pool.request().input('name', sql.NVarChar(100), name).query('INSERT INTO organizations (name) OUTPUT inserted.id VALUES (@name);');
          return res.json({ ok: true, id: result.recordset[0].id });
        } catch (err) {
          if (err.number === 2627 || err.number === 2601) return res.status(409).json({ ok: false, message: 'Organization already exists' });
          throw err;
        }
      }
      if (method === 'PUT' && hasId) {
        const id = parseInt(req.params.id, 10);
        const name = (req.body.name || '').trim();
        if (!name) return res.status(400).json({ ok: false, message: 'Name is required' });
        const result = await pool.request().input('id', sql.Int, id).input('name', sql.NVarChar(100), name).query('UPDATE organizations SET name = @name WHERE id = @id;');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ ok: false, message: 'Not found' });
        return res.json({ ok: true });
      }
      if (method === 'DELETE' && hasId && !hasDomainId) {
        const id = parseInt(req.params.id, 10);
        const subs = await pool.request().input('orgId', sql.Int, id).query('SELECT COUNT(*) AS cnt FROM submissions WHERE org_id = @orgId;');
        if (subs.recordset[0].cnt > 0) return res.status(409).json({ ok: false, message: 'Cannot delete organization with existing submissions' });
        await pool.request().input('orgId', sql.Int, id).query('DELETE FROM org_domains WHERE org_id = @orgId;');
        await pool.request().input('id', sql.Int, id).query('DELETE FROM organizations WHERE id = @id;');
        return res.json({ ok: true });
      }
      if (method === 'POST' && hasId) {
        // Add domain
        const orgId = parseInt(req.params.id, 10);
        const domain = (req.body.domain || '').trim().toLowerCase();
        if (!domain) return res.status(400).json({ ok: false, message: 'Domain is required' });
        try {
          await pool.request().input('orgId', sql.Int, orgId).input('domain', sql.NVarChar(255), domain).query('INSERT INTO org_domains (org_id, domain) VALUES (@orgId, @domain);');
          return res.json({ ok: true });
        } catch (err) {
          if (err.number === 2627 || err.number === 2601) return res.status(409).json({ ok: false, message: 'Domain already mapped' });
          throw err;
        }
      }
      if (method === 'DELETE' && hasDomainId) {
        const domainId = parseInt(req.params.domainId, 10);
        await pool.request().input('id', sql.Int, domainId).query('DELETE FROM org_domains WHERE id = @id;');
        return res.json({ ok: true });
      }
      res.status(404).json({ ok: false, message: 'Not found' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Internal server error' });
    }
  };
}

// Admin Campaigns
async function adminCampaignHandler(method, action) {
  const { verifyAdmin } = await import('./src/lib/adminAuth.js');
  const sql = (await import('mssql')).default;
  
  return async (req, res) => {
    try {
      const fakeRequest = {
        json: async () => req.body,
        params: req.params,
        query: { get: (k) => req.query[k] || null },
        headers: { get: (k) => req.headers[k.toLowerCase()] || null },
      };
      const auth = verifyAdmin(fakeRequest);
      if (!auth.ok) return res.status(auth.response.status).json(auth.response.jsonBody);

      const pool = await getPool();

      if (method === 'GET') {
        const result = await pool.request().query(`
          SELECT c.id, c.display_name, c.total_packs, c.total_weeks, c.copilot_url, c.is_active, c.created_at,
            (SELECT COUNT(DISTINCT gs.player_id) FROM game_sessions gs WHERE gs.campaign_id = c.id) AS total_players,
            (SELECT COUNT(*) FROM game_sessions gs WHERE gs.campaign_id = c.id) AS total_sessions,
            (SELECT COUNT(*) FROM submissions s WHERE s.campaign_id = c.id) AS total_submissions
          FROM campaigns c ORDER BY c.created_at DESC;
        `);
        return res.json({ campaigns: result.recordset.map(c => ({ id: c.id, displayName: c.display_name, totalPacks: c.total_packs, totalWeeks: c.total_weeks, copilotUrl: c.copilot_url, isActive: c.is_active, createdAt: c.created_at, stats: { totalPlayers: c.total_players, totalSessions: c.total_sessions, totalSubmissions: c.total_submissions } })) });
      }
      if (method === 'POST' && !action) {
        const { id, displayName, totalPacks, totalWeeks, copilotUrl } = req.body;
        if (!id || !displayName) return res.status(400).json({ ok: false, message: 'id and displayName required' });
        try {
          await pool.request().input('id', sql.NVarChar(20), id).input('dn', sql.NVarChar(100), displayName).input('tp', sql.Int, totalPacks || 999).input('tw', sql.Int, totalWeeks || 7).input('cu', sql.NVarChar(500), copilotUrl || 'https://m365.cloud.microsoft/chat').query(`INSERT INTO campaigns (id, display_name, total_packs, total_weeks, copilot_url, is_active) VALUES (@id, @dn, @tp, @tw, @cu, 0);`);
          return res.json({ ok: true });
        } catch (err) {
          if (err.number === 2627 || err.number === 2601) return res.status(409).json({ ok: false, message: 'Campaign already exists' });
          throw err;
        }
      }
      if (method === 'PUT') {
        const campaignId = req.params.id;
        const { displayName, totalPacks, totalWeeks, copilotUrl, isActive } = req.body;
        if (isActive) await pool.request().input('id', sql.NVarChar(20), campaignId).query('UPDATE campaigns SET is_active = 0 WHERE id != @id;');
        await pool.request().input('id', sql.NVarChar(20), campaignId).input('dn', sql.NVarChar(100), displayName).input('tp', sql.Int, totalPacks).input('tw', sql.Int, totalWeeks).input('cu', sql.NVarChar(500), copilotUrl).input('ia', sql.Bit, isActive ? 1 : 0).query(`UPDATE campaigns SET display_name = COALESCE(@dn, display_name), total_packs = COALESCE(@tp, total_packs), total_weeks = COALESCE(@tw, total_weeks), copilot_url = COALESCE(@cu, copilot_url), is_active = @ia WHERE id = @id;`);
        return res.json({ ok: true });
      }
      if (action === 'clear') {
        const campaignId = req.params.id;
        const events = await pool.request().input('cid', sql.NVarChar(20), campaignId).query(`DELETE te FROM tile_events te INNER JOIN game_sessions gs ON te.game_session_id = gs.id WHERE gs.campaign_id = @cid;`);
        const sessions = await pool.request().input('cid', sql.NVarChar(20), campaignId).query('DELETE FROM game_sessions WHERE campaign_id = @cid;');
        const submissions = await pool.request().input('cid', sql.NVarChar(20), campaignId).query('DELETE FROM submissions WHERE campaign_id = @cid;');
        return res.json({ ok: true, deleted: { events: events.rowsAffected[0], sessions: sessions.rowsAffected[0], submissions: submissions.rowsAffected[0] } });
      }
      if (action === 'reset-leaderboard') {
        const campaignId = req.params.id;
        const result = await pool.request().input('cid', sql.NVarChar(20), campaignId).query('DELETE FROM submissions WHERE campaign_id = @cid;');
        return res.json({ ok: true, deleted: { submissions: result.rowsAffected[0] } });
      }
      res.status(404).json({ ok: false, message: 'Not found' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Internal server error' });
    }
  };
}

// Admin Players
async function adminPlayerHandler(method, isList) {
  const { verifyAdmin } = await import('./src/lib/adminAuth.js');
  const sql = (await import('mssql')).default;
  
  return async (req, res) => {
    try {
      const fakeRequest = {
        json: async () => req.body,
        params: req.params,
        query: { get: (k) => req.query[k] || null },
        headers: { get: (k) => req.headers[k.toLowerCase()] || null },
      };
      const auth = verifyAdmin(fakeRequest);
      if (!auth.ok) return res.status(auth.response.status).json(auth.response.jsonBody);

      const pool = await getPool();

      if (method === 'GET' && isList) {
        const q = req.query.q || '';
        const result = await pool.request().input('q', sql.NVarChar(320), `%${q}%`).query(`SELECT TOP 50 p.id, p.player_name, p.email, p.created_at, (SELECT COUNT(*) FROM game_sessions gs WHERE gs.player_id = p.id) AS session_count, (SELECT COUNT(*) FROM submissions s WHERE s.player_id = p.id) AS submission_count FROM players p WHERE p.email LIKE @q OR p.player_name LIKE @q ORDER BY p.created_at DESC;`);
        return res.json({ players: result.recordset });
      }
      if (method === 'GET' && !isList) {
        const id = parseInt(req.params.id, 10);
        const player = await pool.request().input('id', sql.Int, id).query('SELECT id, session_id, player_name, email, created_at FROM players WHERE id = @id;');
        if (player.recordset.length === 0) return res.status(404).json({ ok: false, message: 'Player not found' });
        const sessions = await pool.request().input('pid', sql.Int, id).query(`SELECT id, pack_id, campaign_id, tiles_cleared, lines_won, keywords_earned, started_at, last_active_at FROM game_sessions WHERE player_id = @pid ORDER BY last_active_at DESC;`);
        const submissions = await pool.request().input('pid', sql.Int, id).query(`SELECT s.id, o.name AS org, s.keyword, s.campaign_id, s.created_at FROM submissions s JOIN organizations o ON s.org_id = o.id WHERE s.player_id = @pid ORDER BY s.created_at DESC;`);
        return res.json({ player: player.recordset[0], sessions: sessions.recordset, submissions: submissions.recordset });
      }
      if (method === 'DELETE') {
        const id = parseInt(req.params.id, 10);
        await pool.request().input('pid', sql.Int, id).query(`DELETE te FROM tile_events te INNER JOIN game_sessions gs ON te.game_session_id = gs.id WHERE gs.player_id = @pid;`);
        await pool.request().input('pid', sql.Int, id).query('DELETE FROM game_sessions WHERE player_id = @pid;');
        await pool.request().input('pid', sql.Int, id).query('DELETE FROM submissions WHERE player_id = @pid;');
        await pool.request().input('id', sql.Int, id).query('DELETE FROM players WHERE id = @id;');
        return res.json({ ok: true });
      }
      res.status(404).json({ ok: false, message: 'Not found' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Internal server error' });
    }
  };
}

// Admin submission revocation
async function adminSubmissionHandler() {
  const { verifyAdmin } = await import('./src/lib/adminAuth.js');
  const sql = (await import('mssql')).default;
  
  return async (req, res) => {
    try {
      const fakeRequest = {
        json: async () => req.body,
        params: req.params,
        query: { get: (k) => req.query[k] || null },
        headers: { get: (k) => req.headers[k.toLowerCase()] || null },
      };
      const auth = verifyAdmin(fakeRequest);
      if (!auth.ok) return res.status(auth.response.status).json(auth.response.jsonBody);

      const pool = await getPool();
      const id = parseInt(req.params.id, 10);
      const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM submissions WHERE id = @id;');
      if (result.rowsAffected[0] === 0) return res.status(404).json({ ok: false, message: 'Submission not found' });
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Internal server error' });
    }
  };
}

// Register admin org routes
app.get('/api/portal-api/organizations', await adminOrgHandler('GET', false, false));
app.post('/api/portal-api/organizations', await adminOrgHandler('POST', false, false));
app.put('/api/portal-api/organizations/:id', await adminOrgHandler('PUT', true, false));
app.delete('/api/portal-api/organizations/:id', await adminOrgHandler('DELETE', true, false));
app.post('/api/portal-api/organizations/:id/domains', await adminOrgHandler('POST', true, false));
app.delete('/api/portal-api/organizations/:id/domains/:domainId', await adminOrgHandler('DELETE', true, true));

// Register admin campaign routes
app.get('/api/portal-api/campaigns', await adminCampaignHandler('GET'));
app.post('/api/portal-api/campaigns', await adminCampaignHandler('POST'));
app.put('/api/portal-api/campaigns/:id/settings', await adminCampaignHandler('PUT'));
app.post('/api/portal-api/campaigns/:id/clear', await adminCampaignHandler('POST', 'clear'));
app.post('/api/portal-api/campaigns/:id/reset-leaderboard', await adminCampaignHandler('POST', 'reset-leaderboard'));

// Register admin player routes
app.get('/api/portal-api/players', await adminPlayerHandler('GET', true));
app.get('/api/portal-api/players/:id', await adminPlayerHandler('GET', false));
app.delete('/api/portal-api/players/:id', await adminPlayerHandler('DELETE', false));
app.delete('/api/portal-api/submissions/:id', await adminSubmissionHandler());

const PORT = process.env.PORT || 7071;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API running on port ${PORT}`);
});
