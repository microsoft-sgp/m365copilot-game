## 1. Origin allowlist on refresh & logout (M1)

- [ ] 1.1 In [backend/src/lib/adminAuth.ts](backend/src/lib/adminAuth.ts), export a new `requireAllowedOrigin(request): ErrorResponse | null` helper that returns `{ status: 403, jsonBody: { ok: false, message: 'Forbidden origin' } }` when `Origin` is missing or not in `ALLOWED_ORIGINS`, and `null` when allowed. Reuse the existing `isAllowedOrigin` / `getAllowedOrigins` helpers.
- [ ] 1.2 Refactor `verifyJwt` in [backend/src/lib/adminAuth.ts](backend/src/lib/adminAuth.ts) to call `requireAllowedOrigin` for cookie-authed requests instead of inlining the check, preserving current bearer-token behavior (no Origin requirement).
- [ ] 1.3 In [backend/src/functions/adminSession.ts](backend/src/functions/adminSession.ts) `refreshHandler`, call `requireAllowedOrigin(request)` first; if it returns a response, return it immediately without inspecting cookies.
- [ ] 1.4 In [backend/src/functions/adminSession.ts](backend/src/functions/adminSession.ts) `logoutHandler`, call `requireAllowedOrigin(request)` first; if it returns a response, return it immediately without clearing cookies.
- [ ] 1.5 Update the Express dev wrapper [backend/server.js](backend/server.js) so the `/api/portal-api/refresh` and `/api/portal-api/logout` adapters surface the 403 response from the handlers (no extra wrapping needed since `adapt()` forwards `status`/`jsonBody`).
- [ ] 1.6 Add Vitest cases in [backend/src/functions/adminSession.test.js](backend/src/functions/adminSession.test.js): refresh returns 403 when `Origin` header is absent; refresh returns 403 when `Origin` is `https://evil.example`; refresh returns 200 when `Origin` matches `ALLOWED_ORIGINS`; same three cases for logout.
- [ ] 1.7 Run `npm test --prefix backend` and confirm the new tests pass and existing admin-flow tests still pass.

## 2. Move email out of player-state URL (M2)

- [ ] 2.1 In [backend/src/functions/getPlayerState.ts](backend/src/functions/getPlayerState.ts), change the `app.http` registration to `methods: ['POST']` and read the email via `readJsonObject(request)` + `stringValue(body.email)` instead of `request.query.get('email')`. Preserve the empty-email 400 response and the existing token-enforcement behavior verbatim.
- [ ] 2.2 In [frontend/src/lib/api.ts](frontend/src/lib/api.ts), update `apiGetPlayerState(email)` to call `requestGame('POST', '/player/state', { email })` (no `encodeURIComponent` in the URL).
- [ ] 2.3 Update the Express dev route in [backend/server.js](backend/server.js) from `app.get('/api/player/state', …)` to `app.post('/api/player/state', …)`.
- [ ] 2.4 Update [backend/src/functions/getPlayerState.test.js](backend/src/functions/getPlayerState.test.js) and [backend/src/functions/getPlayerState.token.test.js](backend/src/functions/getPlayerState.token.test.js) so the fake request supplies email via `json()` instead of `query.get`. Add an explicit test that the handler returns 400 when the body is `{}`.
- [ ] 2.5 Update [frontend/src/lib/api.test.js](frontend/src/lib/api.test.js) `apiGetPlayerState` test to assert method `POST`, URL `/api/player/state` (no query string), and body `{"email":"…"}`.
- [ ] 2.6 Grep the workspace for any other call sites of `/player/state?email=` or `apiGetPlayerState` and update accordingly. Verify no Playwright e2e fixture depends on the GET shape (`frontend/e2e/`).
- [ ] 2.7 Run `npm test --prefix backend` and `npm test --prefix frontend`; confirm no regressions.

## 3. Atomic OTP consumption (I1)

- [ ] 3.1 In [backend/src/functions/verifyOtp.ts](backend/src/functions/verifyOtp.ts), replace the unconditional `UPDATE admin_otps SET used = 1 WHERE id = @id;` with a conditional `UPDATE admin_otps SET used = 1 WHERE id = @id AND used = 0;`. Capture the `result.rowsAffected[0]` value.
- [ ] 3.2 If `rowsAffected[0] !== 1`, treat as race-loser: log a `verify_failure` with outcome `used_code`, increment the lockout counter via `cacheIncrementWithTtl(lockoutKey(email), LOCKOUT_WINDOW_SECONDS, context)`, and return `401 { ok: false, message: 'Code already used. Please request a new one.' }`. Do this before any token issuance branch (both step-up and standard login paths).
- [ ] 3.3 Add a Vitest case in [backend/src/functions/verifyOtp.test.js](backend/src/functions/verifyOtp.test.js): mock the SELECT to return a valid unused row, and mock the conditional UPDATE to return `rowsAffected: [0]`. Assert the response is 401 with the "already used" message, no cookies are set, and `cacheIncrementWithTtl` was called.
- [ ] 3.4 Confirm the existing "used OTP" branch (where `otp.used` is truthy in the SELECT result) still returns the same 401 — this becomes the fast path; the conditional-UPDATE branch is the race fallback.
- [ ] 3.5 Run `npm test --prefix backend` and confirm the full `verifyOtp.test.js` and `adminSession.test.js` suites pass.

## 4. Validation & cleanup

- [ ] 4.1 Run `npm run lint --prefix backend` and `npm run lint --prefix frontend`; resolve any new warnings.
- [ ] 4.2 Run `npm run typecheck --prefix backend` and `npm run typecheck --prefix frontend`; resolve any new type errors.
- [ ] 4.3 Run `openspec validate --strict harden-admin-session-and-otp` and resolve any reported issues.
- [ ] 4.4 Manual smoke (local Docker stack from [docker-compose.yml](docker-compose.yml)): admin login still succeeds end-to-end; player onboarding still hydrates state; `curl -X POST http://localhost:7071/api/portal-api/refresh` (no Origin) returns 403.
