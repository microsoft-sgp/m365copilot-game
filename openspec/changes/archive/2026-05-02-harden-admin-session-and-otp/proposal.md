## Why

A code-level security review of the `develop` branch surfaced three small but real holes around admin session and OTP handling: the refresh/logout endpoints bypass the Origin allowlist (CSRF posture for session extension and forced logout), the player-state endpoint puts email addresses into URL query strings (PII in App Service / App Insights logs), and the OTP verify path has a sub-millisecond race window that can let one valid 6-digit code be redeemed twice. None are exploitable for full takeover, but each undermines a stated security control.

## What Changes

- Apply the existing Origin allowlist (already used by `verifyAdmin`) to `POST /api/portal-api/refresh` and `POST /api/portal-api/logout` so cross-origin pages cannot extend a victim admin's session or force them out.
- Move the player email out of the query string for player-state lookups: change `GET /api/player/state?email=…` to `POST /api/player/state` (request body) so the address never lands in URL access logs / `requests.url` telemetry. Frontend `apiGetPlayerState` updates accordingly. **BREAKING** for any external consumer of the GET shape (none expected — only the SPA calls it).
- Make admin OTP consumption atomic: replace the unconditional `UPDATE admin_otps SET used = 1 WHERE id = @id` with `WHERE id = @id AND used = 0`, and only issue access/refresh/step-up tokens when `rowsAffected[0] === 1`. Closes the read-then-write race so two parallel verify calls cannot both succeed with the same code.
- Add unit tests for each fix (Origin-rejected refresh/logout, POST shape for player-state, race-loser path on verifyOtp).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `admin-auth`: refresh/logout endpoints gain Origin allowlist enforcement; OTP verification adds the atomic-consumption requirement.
- `player-identity`: cross-device state retrieval moves to `POST /api/player/state`; email no longer appears in any URL.
- `game-api`: `/player/state` route changes from GET (query) to POST (body).

## Impact

- **Code**: [backend/src/lib/adminAuth.ts](backend/src/lib/adminAuth.ts) (extract `requireAllowedOrigin` helper), [backend/src/functions/adminSession.ts](backend/src/functions/adminSession.ts) (apply helper), [backend/src/functions/verifyOtp.ts](backend/src/functions/verifyOtp.ts) (atomic UPDATE + race handling), [backend/src/functions/getPlayerState.ts](backend/src/functions/getPlayerState.ts) (method + body parsing), [frontend/src/lib/api.ts](frontend/src/lib/api.ts) (`apiGetPlayerState` POST), [backend/server.js](backend/server.js) (Express dev wrapper route updates), tests in [backend/src/functions/](backend/src/functions/).
- **APIs**: `/player/state` becomes POST; refresh/logout return 403 on missing/forbidden Origin instead of always 200/401.
- **Dependencies**: none new.
- **Rollback**: revert the change PR; no database migrations, no infra changes, no secret rotation. Old admin sessions remain valid because JWT signing keys and cookie names are unchanged.
- **Affected teams**: backend (handlers + tests), frontend (single API call signature), ops (no action — no env vars or infra change).
