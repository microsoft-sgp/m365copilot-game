## 1. Backend health endpoint

- [x] 1.1 Create `backend/src/functions/health.js` exporting an Azure Functions `handler` that probes the database via `getPool()` with `SELECT 1` and returns the structured payload (`ok`, `status`, `api`, `database`, `checkedAt`).
- [x] 1.2 Register the handler with `app.http('health', { methods: ['GET'], authLevel: 'anonymous', route: 'health', handler })`.
- [x] 1.3 Wrap the DB probe in try/catch so any failure resolves to `{ status: "degraded", database: "down" }` with HTTP 200 (never throw, never include error messages in the body).
- [x] 1.4 Add a matching Express route in `backend/server.js` so the local Docker stack also serves `GET /api/health`.
- [x] 1.5 Create `backend/src/functions/health.test.js` covering: healthy path (mocked pool resolves), degraded path (mocked pool query rejects), and that the response body never leaks error details.
- [x] 1.6 Add a smoke check to `scripts/smoke-test.sh` for `GET /api/health` returning `"status":"healthy"`.

## 2. Frontend API client

- [x] 2.1 Add `apiGetHealth()` to `frontend/src/lib/api.js` using the existing `request('GET', '/health')` helper so failures normalize to `status: 0`.

## 3. Frontend health composable

- [x] 3.1 Create `frontend/src/composables/useHealthStatus.js` exporting a singleton-style composable that exposes a reactive `status` ref with values `unknown` | `healthy` | `degraded` | `down`.
- [x] 3.2 Implement `start()` to fire an immediate probe, then `setInterval(probe, 30000)`, and register a `visibilitychange` listener that re-probes when `document.visibilityState === 'visible'`.
- [x] 3.3 Implement `stop()` to clear the interval and remove the visibility listener.
- [x] 3.4 Map probe outcomes to status: `status === 'healthy'` → `healthy`; `status === 'degraded'` → `degraded`; network failure (`res.status === 0`) → `down`.
- [x] 3.5 Create `frontend/src/composables/useHealthStatus.test.js` covering each state transition (mount → unknown → healthy, healthy → degraded, healthy → down, down → healthy on recovery) using fake timers and a mocked `apiGetHealth`.

## 4. Footer indicator UI

- [x] 4.1 Update `frontend/src/components/GameFooter.vue` to import `useHealthStatus`, call `start()` in `onMounted`, and `stop()` in `onUnmounted`.
- [x] 4.2 Render a status row above the existing two attribution lines containing a colored dot (Tailwind tokens — green for healthy, amber for degraded, red for down, neutral grey for unknown) and one label word (`Online` / `Degraded` / `Offline` / `Checking…`).
- [x] 4.3 Ensure the row is always present from first paint (no v-if hiding the slot before first probe) so layout does not reflow when the first response arrives.
- [x] 4.4 Verify no tooltip or hover-only content is added; the visible label must stand on its own.
- [x] 4.5 Confirm the indicator does not appear on admin views by manual check (admin views never render `GameFooter`).

## 5. Frontend tests

- [x] 5.1 Create `frontend/src/components/GameFooter.test.js` using Vitest + Vue Test Utils to assert: initial `Checking…` render, `Online` after a healthy probe, `Degraded` after a degraded probe, and `Offline` after a network-failure probe.

## 6. Validation

- [x] 6.1 Run `npm test` in `backend/` and `frontend/` — all new and existing tests pass.
- [x] 6.2 Run `scripts/smoke-test.sh` against the local Docker stack — health check passes alongside existing checks.
- [x] 6.3 Manual verification: load the game, observe `Online`; stop the database container, observe `Degraded` within 30s; stop the API container, observe `Offline` within 30s; restart both, observe recovery to `Online`.
- [x] 6.4 Run `openspec validate add-footer-health-status --strict` and confirm no errors.
