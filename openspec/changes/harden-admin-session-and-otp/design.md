## Context

Three security findings from the April-29 code review of `develop` are bundled here because they share the same surface area (admin auth + adjacent player API), have small blast radius, and can ship in one PR with no migration:

- **M1 — refresh/logout skip Origin allowlist**: [backend/src/lib/adminAuth.ts](backend/src/lib/adminAuth.ts) enforces an Origin allowlist inside `verifyJwt` for cookie-authed requests, but [backend/src/functions/adminSession.ts](backend/src/functions/adminSession.ts) reads `admin_refresh` directly without going through `verifyAdmin`. A cross-origin page can therefore drive `/api/portal-api/refresh` (extending a victim admin's session) or `/api/portal-api/logout` (forced logout). HttpOnly cookies prevent token theft; impact is session-availability + state mismatch.
- **M2 — email in URL query**: [backend/src/functions/getPlayerState.ts](backend/src/functions/getPlayerState.ts) reads `request.query.get('email')`. The address ends up in nginx access logs, App Service request logs, and `requests.url` in App Insights — a slow-burn PII leak that no telemetry processor is configured to scrub.
- **I1 — OTP double-spend race**: [backend/src/functions/verifyOtp.ts](backend/src/functions/verifyOtp.ts) does `SELECT … WHERE email AND code_hash` then `UPDATE … SET used = 1 WHERE id`. Two concurrent verify requests for the same valid code each see `used = 0` and each receive an admin session.

Constraints: Azure Functions v4 (TypeScript), Azure SQL via `mssql`, Vitest tests, the existing local Express adapter [backend/server.js](backend/server.js) which mirrors prod routes for Docker dev. No infra/Bicep/Terraform changes; no env vars added.

## Goals / Non-Goals

**Goals:**
- Close the three findings with the smallest possible diffs.
- Preserve the existing admin and player auth contracts (cookie names, JWT shape, OTP TTL, lockout window).
- Add Vitest coverage that locks in the new behaviour.
- Keep the dev Express wrapper in sync so Docker testing matches prod.

**Non-Goals:**
- Restructuring `verifyAdmin` or its return type.
- Changing OTP / JWT / cookie TTLs.
- Adding per-IP rate limiting (tracked separately as L5).
- Replacing the player-state endpoint with a richer body schema — this change keeps the body shape minimal (`{ email }`) so the migration is trivial.

## Decisions

### D1 — Extract `requireAllowedOrigin(request)` helper from `verifyJwt`
The existing Origin check lives inside `verifyJwt` and only runs when a cookie token is present. Refresh/logout do not call `verifyJwt`. Rather than duplicate the logic, extract a small `requireAllowedOrigin(request): ErrorResponse | null` helper alongside the existing `isAllowedOrigin` and `getAllowedOrigins` in [backend/src/lib/adminAuth.ts](backend/src/lib/adminAuth.ts). `verifyJwt` keeps its current behaviour by calling the new helper internally; `refreshHandler` and `logoutHandler` call it as their first step.

**Alternatives considered**: (a) Use `verifyAdmin` itself in refresh/logout — rejected because refresh must work when the access JWT has *expired* (the whole point of refresh), so we cannot require a valid access token. (b) Add a generic CORS middleware — Functions v4 has no middleware concept; we'd have to fake it. The helper keeps the explicit per-handler call site visible.

**Behaviour**: missing or non-allowlisted Origin → `403 { ok: false, message: 'Forbidden origin' }`. Same shape as the existing branch.

### D2 — `POST /api/player/state` with `{ email }` body
Switch HTTP method and read `email` from `readJsonObject(request)`. The cookie/`X-Player-Token` header continues to authenticate. Frontend [frontend/src/lib/api.ts](frontend/src/lib/api.ts) `apiGetPlayerState` becomes a POST. The Express dev adapter in [backend/server.js](backend/server.js) updates the route definition.

**Alternatives considered**: (a) Keep GET but hash the email into a path segment — rejected because the unhashed value still has to travel via header (`x-player-email`), which still hits some logs and violates the principle of least exposure. (b) Use `GET /api/player/state` with no email and look up by player token alone — viable but expands token scope (current token is per-row, lookup-by-token would need either a token→player index or table scan). Out of scope here.

**Compatibility**: only the SPA calls this endpoint (verified via grep for `/player/state` across the workspace). Browser caches will issue a fresh POST; no cache-busting needed.

### D3 — Atomic OTP consumption
Replace:
```sql
UPDATE admin_otps SET used = 1 WHERE id = @id;
```
with:
```sql
UPDATE admin_otps SET used = 1 WHERE id = @id AND used = 0;
```
and gate token issuance on `result.rowsAffected[0] === 1`. If the UPDATE finds the row already used (race loser, or replay), respond with the existing `'Code already used. Please request a new one.'` 401 and increment the lockout counter via `cacheIncrementWithTtl` (same path the explicit `otp.used` branch uses today).

**Alternatives considered**: (a) Wrap select+update in a SQL transaction with `SERIALIZABLE` — heavier and unnecessary; the conditional UPDATE is already a single atomic statement under SQL Server's row locking. (b) Use Redis SETNX as the redemption gate — adds a Redis dependency for token issuance which is currently optional.

### D4 — Test approach
- `adminSession.test.js`: assert refresh and logout both return 403 when Origin is missing or not in `ALLOWED_ORIGINS`; both succeed when Origin matches.
- `verifyOtp.test.js`: add a "race loser" test that primes the OTP row as `used = 1` after the SELECT branch, and verifies no token is issued (mock `request().query()` so the second UPDATE returns `rowsAffected: [0]`).
- `getPlayerState.test.js`: assert the handler reads email from JSON body, returns 400 when body lacks email, and that token enforcement still works the same way.
- Frontend `api.test.js`: update `apiGetPlayerState` test to assert POST + body.

## Risks / Trade-offs

- **[Risk] Refresh requires Origin even when called from same-origin first-party UI on a freshly-loaded page** — Modern browsers always send `Origin` on POST; this matches the current behaviour of every other admin endpoint via `verifyAdmin`. Mitigation: same-origin POSTs already work today (the SPA calls refresh on hash-route entry); we'll add an e2e/playwright smoke if the existing `admin-flow.spec.ts` doesn't already cover it.
- **[Risk] POST /player/state breaks any external script not in the repo** — Mitigation: the only documented caller is the SPA. The route is `anonymous` (no auth-level docs leak it). If a hidden caller exists, the change is reversible by adding back the GET handler alongside the new POST.
- **[Risk] `WHERE id = @id AND used = 0` returns 0 rows on race-loser; the lockout increment could lock a legitimate admin out faster than today** — race window is sub-millisecond and only triggered by parallel verify with a matching code; the user-visible response is identical to the existing "Code already used" branch which already increments lockout. Mitigation: keep the existing 5-attempt window unchanged; document in the test name that race-loser counts as one failure.

## Migration Plan

1. Land all four code changes plus tests in a single PR.
2. Deploy normally — no env vars, no migrations, no infra.
3. Verify post-deploy: `curl -X POST .../portal-api/refresh` without Origin → 403; SPA admin login still works in browser.
4. **Rollback**: revert the PR. Active admin sessions stay valid (JWT secret unchanged); active player sessions stay valid (cookies unchanged); pending OTP rows stay valid (TTL unchanged).
