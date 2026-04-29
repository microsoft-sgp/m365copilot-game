## 1. Database migration

- [x] 1.1 Create `database/009-player-owner-token.sql` adding nullable `players.owner_token NVARCHAR(64)` column and filtered index `IX_players_owner_token` (idempotent: guarded by `COL_LENGTH` and `sys.indexes` checks)
- [x] 1.2 Wire migration into `scripts/init-db.mjs` and `backend/scripts/run-migrations.mjs` (append to the migration list after `008`)
- [x] 1.3 Apply against the local docker-compose stack (`docker compose down -v && docker compose up -d`) and confirm the column appears via `docker compose exec -T db /opt/mssql-tools/bin/sqlcmd ... 'SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(''players'')'`

## 2. Backend: token library

- [x] 2.1 Add `backend/src/lib/playerAuth.ts` with `generatePlayerToken()` (32-byte `randomBytes` → base64url), `hashPlayerToken(token)` (SHA-256 hex), `getPlayerTokenFromRequest(request)` (cookie-then-header), and `verifyPlayerOwnsRow(presentedToken, storedHash)` (constant-time)
- [x] 2.2 Add `backend/src/lib/playerCookies.ts` mirroring `adminCookies.ts` for `player_token` (`SameSite=None; Secure; HttpOnly; Path=/api`); export `createPlayerTokenCookie(token)` and `clearPlayerTokenCookie()`
- [x] 2.3 Add `backend/src/lib/playerAuth.test.js` covering generation length, hash determinism, constant-time mismatch path, and cookie/header extraction
- [x] 2.4 Add `isPlayerTokenEnforcementEnabled()` helper that reads `process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT` (default true; only `'false'` disables)

## 3. Backend: enforce on existing endpoints

- [x] 3.1 `createSession.ts`: on insert, generate token + set `owner_token` hash; on existing player with null `owner_token`, atomically `UPDATE ... WHERE id=@id AND owner_token IS NULL`; on existing player with non-null `owner_token`, require matching token else return 409 `Identity in use`; always set the `player_token` cookie and include `playerToken` in JSON body
- [x] 3.2 `updateSession.ts`: when enforcement enabled, look up `game_sessions.player_id` → join `players.owner_token` and require match; on mismatch return 401 (no row mutation)
- [x] 3.3 `recordEvent.ts`: extend the existing `check` query to project `players.owner_token`; when enforcement enabled, require match; mismatch returns 401 before any insert
- [x] 3.4 `submitKeyword.ts`: after resolving the player by email, when enforcement enabled require token match against `players.owner_token`; mismatch returns 401 before submission insert
- [x] 3.5 `getPlayerState.ts`: when enforcement enabled and the player record exists, require token match; on mismatch return `{ ok: true, player: null }` (same shape as no-record branch — no existence oracle)

## 4. Backend: tests

- [x] 4.1 Update `createSession.test.js` for token issuance on create, reuse on matching token, 409 on mismatch, atomic claim on legacy null row
- [x] 4.2 Update `updateSession.test.js`, `recordEvent.test.js`, `submitKeyword.test.js`, `getPlayerState.test.js` to add: 401 on missing token (enforcement on), 401 on mismatched token, success on matching token, legacy pass-through on enforcement off
- [x] 4.3 Add a focused test that flips `ENABLE_PLAYER_TOKEN_ENFORCEMENT=false` and confirms all four endpoints accept token-less calls (rollout safety)
- [x] 4.4 Run `cd backend && npm run typecheck && npm run lint && npm test` — all must pass before moving on

## 5. Frontend: token capture and forwarding

- [x] 5.1 Add `frontend/src/lib/playerToken.ts` with `getPlayerToken()` / `setPlayerToken(token)` / `clearPlayerToken()` backed by `sessionStorage` under key `copilot_bingo_player_token`
- [x] 5.2 Update `frontend/src/lib/api.ts` so every `fetch` already using `credentials: 'include'` also injects `X-Player-Token` from `getPlayerToken()` when present
- [x] 5.3 Update the session-create call site (in `useBingoGame.ts` / `App.vue` whichever owns it) to call `setPlayerToken(response.playerToken)` immediately after a successful response
- [x] 5.4 Add 401 handling in `api.ts` (or its consumer): on 401 from any game endpoint, `clearPlayerToken()`, re-call `POST /api/sessions`, persist the new token, and retry the original call exactly once
- [x] 5.5 Hook the existing identity-clear / email-change flow to also call `clearPlayerToken()`

## 6. Frontend: tests

- [x] 6.1 Add `frontend/src/lib/playerToken.test.js` covering get/set/clear and `sessionStorage` isolation
- [x] 6.2 Update `frontend/src/lib/api.test.js` to assert `X-Player-Token` is forwarded when present and absent when not, and that `credentials: 'include'` is preserved
- [x] 6.3 Add an `App.test.js` (or composable test) case for the 401-retry path
- [x] 6.4 Update Playwright `e2e/player-flow.spec.ts` to assert that the SPA captures `playerToken` after onboarding and includes the `X-Player-Token` header on a subsequent submission
- [x] 6.5 Run `cd frontend && npm run typecheck && npm run lint && npm test && npm run e2e:ci` — all must pass

## 7. Infra and rollout

- [x] 7.1 Add `ENABLE_PLAYER_TOKEN_ENFORCEMENT` to `infra/terraform/variables.tf` with a `default = false` boolean and validation
- [x] 7.2 Surface it in `infra/terraform/main.tf` `app_settings` block alongside the other admin TTL settings
- [x] 7.3 Document in `DEPLOYMENT.md` (or rollout runbook) the bake order: deploy migration → backend → frontend with flag `false` for 24 h, then flip to `true`
- [x] 7.4 Document the support recovery path: an admin can `UPDATE players SET owner_token = NULL WHERE email = @email` to allow a legitimate user on a new device to re-claim their identity

## 8. Smoke verification

- [x] 8.1 `docker compose down -v && docker compose up -d`; confirm migrations 001–009 all log success
- [x] 8.2 `curl POST /api/sessions` for a new email; assert response includes `playerToken` and `Set-Cookie: player_token=...; HttpOnly`
- [x] 8.3 With `ENABLE_PLAYER_TOKEN_ENFORCEMENT=true`, `curl POST /api/events` without the token returns 401; with the cookie returns 200
- [x] 8.4 With `ENABLE_PLAYER_TOKEN_ENFORCEMENT=false`, both calls succeed (rollout-mode regression check)
- [x] 8.5 `curl GET /api/player/state?email=<other-email>` without token returns `{ok: true, player: null}` even when that email exists
- [x] 8.6 Re-run the full review's H1/H2 attacks and confirm they now fail
