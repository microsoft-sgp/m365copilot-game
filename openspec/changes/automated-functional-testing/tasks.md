## 1. Playwright harness and fixtures

- [x] 1.1 Refactor or extend [frontend/e2e/fixtures.ts](frontend/e2e/fixtures.ts) so mocked API setup supports route overrides, request capture, admin portal fixture data, player fixture data, and reusable JSON responses.
- [x] 1.2 Update the mocked player-state route to the hardening target contract: `POST /api/player/state` with `{ email }` in the JSON body and no email in the request URL.
- [x] 1.3 Add reusable Playwright helpers for player onboarding, launching an assigned board, verifying a tile with fixture proof, admin OTP login, tab navigation, confirmation dialog accept/cancel, and cookie/storage assertions.
- [x] 1.4 Add or update Playwright configuration/package scripts for the default fast mocked suite and an explicitly gated full-stack suite (for example `FULLSTACK_E2E=1` plus `E2E_BASE_URL=http://localhost:8080`).

## 2. Fast mocked player coverage

- [x] 2.1 Add Playwright coverage for onboarding validation: missing display name, missing email, invalid email, public email requiring organization, and private/known-domain email continuing without manual organization.
- [x] 2.2 Expand the existing player happy path to verify assigned pack launch, valid proof submission, three cleared tiles, line-win modal feedback, keyword creation, event recording, session patching, activity tab, and leaderboard display.
- [x] 2.3 Add persistence coverage that reloads after gameplay and verifies identity, active board, cleared tiles, and earned keywords restore from browser storage.
- [x] 2.4 Add token coverage that asserts `X-Player-Token` is forwarded after session creation and that a simulated 401 on a protected game endpoint clears the stale token, re-bootstraps with `POST /api/sessions`, and retries the original request exactly once.
- [x] 2.5 Extend responsive coverage beyond grid layout to include opening a tile modal and closing a win modal on at least one narrow viewport without horizontal overflow.

## 3. Fast mocked admin coverage

- [x] 3.1 Expand admin login/session coverage to verify OTP validation states, successful cookie-backed login, absence of admin JWT strings in `localStorage`/`sessionStorage`, refresh-on-direct-admin-route behavior, and logout return to the game entry view.
- [x] 3.2 Add dashboard/export coverage that verifies summary metrics, recent sessions, recent score events, and CSV download behavior with mocked API responses.
- [x] 3.3 Add organization management coverage for create, duplicate/error, edit, add domain, remove domain, delete cancel, and delete confirm paths.
- [x] 3.4 Add campaign management coverage for create, create-error, edit settings, cancel edit, and activate/deactivate paths.
- [x] 3.5 Add player management coverage for search, empty search no-op, select detail, revoke submission cancel/confirm, delete player cancel/confirm, and refresh after mutations.
- [x] 3.6 Add admin access coverage for list admins, add-admin step-up OTP success, step-up failure blocking mutation, cancel step-up, and disable-admin step-up success.
- [x] 3.7 Add danger-zone coverage for wrong confirmation phrase, dialog cancel, clear campaign success, clear campaign failure, reset leaderboard success, and reset leaderboard failure.

## 4. Hardening and full-stack smoke coverage

- [x] 4.1 Add browser contract coverage that captures player-state requests and asserts method `POST`, URL path `/api/player/state`, no email in query/path, and email only in the JSON body.
- [x] 4.2 Add a local-only OTP seed helper or script that inserts a known valid OTP for the Docker Compose SQL database using the backend OTP hashing logic; document it as test-only and do not expose a new HTTP endpoint.
- [x] 4.3 Add gated full-stack Playwright API tests for admin refresh Origin enforcement: allowed Origin succeeds, missing Origin returns 403, forbidden Origin returns 403, and rejected responses do not rotate auth cookies.
- [x] 4.4 Add gated full-stack Playwright API tests for admin logout Origin enforcement: allowed Origin clears cookies, missing Origin returns 403, forbidden Origin returns 403, and rejected responses do not clear auth cookies.
- [x] 4.5 Add a gated full-stack OTP replay/race test that seeds one valid OTP, sends two concurrent `verify-otp` requests with the same code, and asserts exactly one success plus one already-used 401 without auth cookies on the failed response.
- [x] 4.6 Add a gated full-stack player smoke that uses a unique email/name, creates a real session through the local backend, verifies gameplay still reaches a line win, and avoids relying on shared Azure resources.
- [x] 4.7 Add guardrails so full-stack/destructive tests skip unless the explicit full-stack environment variable is set and the base URL points at an approved local host.

## 5. Documentation and validation

- [x] 5.1 Update repository testing documentation with the fast Playwright command, what the mocked suite covers, and the expected runtime prerequisites.
- [x] 5.2 Document the full-stack smoke workflow: start Docker Compose, set required environment variables, run the full-stack Playwright command, and avoid shared Azure targets.
- [x] 5.3 Run `npm test --prefix frontend` and add/update Vitest coverage for any new frontend helper logic that is not directly covered by Playwright.
- [x] 5.4 If a backend OTP seed helper/script is added, run `npm test --prefix backend` and add/update Vitest coverage for any new backend helper logic where practical.
- [x] 5.5 Run `npm run lint --prefix frontend`, `npm run typecheck --prefix frontend`, and the matching backend lint/typecheck commands if backend test helper code was added.
- [x] 5.6 Run `npm run e2e --prefix frontend` for the fast mocked suite and record any known failures caused by still-pending hardening implementation.
- [x] 5.7 Run the gated full-stack Playwright smoke against Docker Compose when the local stack is available; otherwise document that it was not run.
- [x] 5.8 Run `openspec validate --strict automated-functional-testing` and resolve any artifact validation issues.