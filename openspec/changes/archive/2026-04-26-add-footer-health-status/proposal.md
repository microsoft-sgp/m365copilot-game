## Why

Players currently have no way to tell whether the app is functioning end to end. When the API or database is unavailable, game actions silently fall back to local state and leaderboard data goes stale, leaving players uncertain whether their progress is being recorded. A small, always-visible health indicator in the footer gives honest at-a-glance feedback and reduces support questions during outages.

## What Changes

- Add a backend health endpoint `GET /api/health` that probes the database with a lightweight query and returns overall, api, and database status fields.
- Render a compact health status label inside `GameFooter.vue`, above the existing attribution text, on game-facing views only (not admin views).
- Implement a small frontend composable that polls the health endpoint every 30 seconds, probes immediately on mount, and re-probes when the tab becomes visible again.
- Define four label states: `Unknown` (initial, before first response), `Healthy`, `Degraded` (API reachable but database probe failed), `Down` (API unreachable or timed out).
- Keep the label copy short and player-friendly (e.g., "Online", "Degraded", "Offline", "Checking…") with a colored status dot. No tooltip, no admin/DB jargon in the visible text.

## Capabilities

### New Capabilities

_None — this change extends existing capabilities only._

### Modified Capabilities

- `game-footer`: Add requirement for a service health status label rendered above the attribution text on game views.
- `game-api`: Add requirement for a public, unauthenticated `GET /api/health` endpoint reporting API and database health.

## Impact

- **Backend**: New Azure Function `health.js` under `backend/src/functions/`, registered at route `health`. Adds a `pingDb()` helper or inline lightweight query (e.g., `SELECT 1`) using the shared pool from `backend/src/lib/db.js`. Local Express adapter in `backend/server.js` gets a matching route.
- **Frontend**: New composable `useHealthStatus.js` and a small status-pill subcomponent (or inline element) inside `GameFooter.vue`. New `apiGetHealth()` helper in `frontend/src/lib/api.js`.
- **Tests**: New backend unit tests for the health handler covering healthy and DB-failure paths; new frontend test for `GameFooter.vue` covering each visible state.
- **Docs**: `scripts/smoke-test.sh` gains a check for `GET /api/health`.
- **Affected teams**: Frontend (footer + composable), Backend (new endpoint).
- **Rollback plan**: Single commit revert. The endpoint is additive and the footer label is purely additive UI; reverting removes both with no schema changes and no breaking API impact.
