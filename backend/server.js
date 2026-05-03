// Lightweight Express wrapper that loads Azure Functions handlers
// for local Docker testing. Not used in production (Azure Functions runtime).
import { captureBackendException, initBackendSentry } from './dist/lib/sentry.js';
import express from 'express';

const app = express();
initBackendSentry('local-express');
app.use(express.json());

// CORS for frontend
app.use((req, res, next) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.origin;
  const allowedOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Admin-Key, X-Player-Token, sentry-trace, baggage',
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Adapter: convert Express req/res to Azure Functions request/response shapes
function adapt(handlerModule) {
  return async (req, res) => {
    let fakeRequest;
    try {
      const mod = typeof handlerModule === 'function' ? { handler: handlerModule } : handlerModule;
      const handler = mod.handler || mod.default;

      fakeRequest = {
        method: req.method,
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        json: async () => req.body,
        params: req.params,
        query: { get: (k) => req.query[k] || null },
        headers: { get: (k) => req.headers[k.toLowerCase()] || null },
      };

      const result = await handler(fakeRequest, { log: console.log });

      if (result.headers) {
        Object.entries(result.headers).forEach(([k, v]) => res.set(k, v));
      }
      if (result.cookies) {
        result.cookies.forEach((cookie) => {
          res.cookie(cookie.name, cookie.value, {
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite?.toLowerCase(),
            maxAge: typeof cookie.maxAge === 'number' ? cookie.maxAge * 1000 : undefined,
          });
        });
      }
      if (result.body && !result.jsonBody) {
        res.status(result.status || 200).send(result.body);
      } else {
        res.status(result.status || 200).json(result.jsonBody);
      }
    } catch (err) {
      await captureBackendException(err, {
        runtime: 'local-express',
        functionName: `${req.method} ${req.path}`,
        request: fakeRequest,
      });
      console.error('Handler error:', err);
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(500).json({ ok: false, message });
    }
  };
}

// Import all handlers
const { handler: createSession } = await import('./dist/functions/createSession.js');
const { handler: updateSession } = await import('./dist/functions/updateSession.js');
const { handler: recordEvent } = await import('./dist/functions/recordEvent.js');
const { handler: submitKeyword } = await import('./dist/functions/submitKeyword.js');
const { handler: getLeaderboard } = await import('./dist/functions/getLeaderboard.js');
const { handler: adminDashboard } = await import('./dist/functions/adminDashboard.js');
const { handler: exportCsv } = await import('./dist/functions/exportCsv.js');
const { handler: getActiveCampaign } = await import('./dist/functions/getActiveCampaign.js');
const { handler: getOrgDomains } = await import('./dist/functions/getOrgDomains.js');
const { handler: getPlayerState } = await import('./dist/functions/getPlayerState.js');
const { handler: requestOtp } = await import('./dist/functions/requestOtp.js');
const { handler: verifyOtp } = await import('./dist/functions/verifyOtp.js');
const { handler: requestPlayerRecovery } =
  await import('./dist/functions/requestPlayerRecovery.js');
const { handler: verifyPlayerRecovery } = await import('./dist/functions/verifyPlayerRecovery.js');
const { refreshHandler, logoutHandler } = await import('./dist/functions/adminSession.js');
const { handler: health } = await import('./dist/functions/health.js');

// Admin org/campaign/player handlers are registered differently (multiple per file)
// Import the modules to trigger app.http registrations, but we'll route manually
const adminOrgs = await import('./dist/functions/adminOrganizations.js');
const adminCampaigns = await import('./dist/functions/adminCampaigns.js');
const adminPlayers = await import('./dist/functions/adminPlayers.js');
const adminAdmins = await import('./dist/functions/adminAdmins.js');

// Public routes
app.get('/api/health', adapt({ handler: health }));
app.post('/api/sessions', adapt({ handler: createSession }));
app.patch('/api/sessions/:id', adapt({ handler: updateSession }));
app.post('/api/events', adapt({ handler: recordEvent }));
app.post('/api/submissions', adapt({ handler: submitKeyword }));
app.get('/api/leaderboard', adapt({ handler: getLeaderboard }));
app.get('/api/campaigns/active', adapt({ handler: getActiveCampaign }));
app.get('/api/organizations/domains', adapt({ handler: getOrgDomains }));
app.post('/api/player/state', adapt({ handler: getPlayerState }));
app.post('/api/player/recovery/request', adapt({ handler: requestPlayerRecovery }));
app.post('/api/player/recovery/verify', adapt({ handler: verifyPlayerRecovery }));

// Admin auth
app.post('/api/portal-api/request-otp', adapt({ handler: requestOtp }));
app.post('/api/portal-api/verify-otp', adapt({ handler: verifyOtp }));
app.post('/api/portal-api/refresh', adapt({ handler: refreshHandler }));
app.post('/api/portal-api/logout', adapt({ handler: logoutHandler }));

// Admin dashboard & export
app.get('/api/portal-api/dashboard', adapt({ handler: adminDashboard }));
app.get('/api/portal-api/export', adapt({ handler: exportCsv }));

// Multi-handler admin modules: register named exports through the same adapt()
// helper used for single-handler files. This keeps dev/prod auth, validation,
// and SQL behavior identical — the dev wrapper does not reimplement anything.
const {
  listOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  addDomain,
  removeDomain,
} = adminOrgs;
const {
  listCampaigns,
  createCampaign,
  updateCampaignSettings,
  clearCampaignData,
  resetLeaderboard,
} = adminCampaigns;
const { searchPlayers, getPlayerDetail, deletePlayer, revokeSubmission } = adminPlayers;
const { listAdmins, addAdmin, removeAdmin } = adminAdmins;

// Admin organizations
app.get('/api/portal-api/organizations', adapt({ handler: listOrganizations }));
app.post('/api/portal-api/organizations', adapt({ handler: createOrganization }));
app.put('/api/portal-api/organizations/:id', adapt({ handler: updateOrganization }));
app.delete('/api/portal-api/organizations/:id', adapt({ handler: deleteOrganization }));
app.post('/api/portal-api/organizations/:id/domains', adapt({ handler: addDomain }));
app.delete('/api/portal-api/organizations/:id/domains/:domainId', adapt({ handler: removeDomain }));

// Admin campaigns
app.get('/api/portal-api/campaigns', adapt({ handler: listCampaigns }));
app.post('/api/portal-api/campaigns', adapt({ handler: createCampaign }));
app.put('/api/portal-api/campaigns/:id/settings', adapt({ handler: updateCampaignSettings }));
app.post('/api/portal-api/campaigns/:id/clear', adapt({ handler: clearCampaignData }));
app.post('/api/portal-api/campaigns/:id/reset-leaderboard', adapt({ handler: resetLeaderboard }));

// Admin players + submissions
app.get('/api/portal-api/players', adapt({ handler: searchPlayers }));
app.get('/api/portal-api/players/:id', adapt({ handler: getPlayerDetail }));
app.delete('/api/portal-api/players/:id', adapt({ handler: deletePlayer }));
app.delete('/api/portal-api/submissions/:id', adapt({ handler: revokeSubmission }));

// Admin user management
app.get('/api/portal-api/admins', adapt({ handler: listAdmins }));
app.post('/api/portal-api/admins', adapt({ handler: addAdmin }));
app.delete('/api/portal-api/admins/:email', adapt({ handler: removeAdmin }));

const PORT = process.env.PORT || 7071;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API running on port ${PORT}`);
});
