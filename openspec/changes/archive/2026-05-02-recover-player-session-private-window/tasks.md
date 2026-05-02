## 1. Database And Token Model

- [x] 1.1 Add an idempotent SQL migration for `player_device_tokens` with player FK, token hash, created/last-seen/revoked timestamps, and indexes for active token lookups.
- [x] 1.2 Add an idempotent SQL migration for `player_recovery_otps` with email, code hash, expiry, used flag, timestamps, and lookup indexes.
- [x] 1.3 Update migration tests to assert both new tables and their key indexes/constraints exist.
- [x] 1.4 Add player-auth helpers for creating device-token rows and verifying a presented token against `players.owner_token` or active device tokens.
- [x] 1.5 Update existing session/event/submission/state ownership checks to use the shared device-token-aware verification path.

## 2. Backend Recovery Flow

- [x] 2.1 Add a player recovery email sender or generalized OTP email helper that keeps admin and player message subjects/content separate.
- [x] 2.2 Implement `POST /api/player/recovery/request` with neutral responses, email validation, request cooldown, hashed code storage, ACS email send, and non-sensitive structured logging.
- [x] 2.3 Implement `POST /api/player/recovery/verify` with email/code validation, failure lockout, atomic code consumption, device-token issuance, `player_token` cookie setting, and `playerToken` response.
- [x] 2.4 Register new recovery functions in the Azure Functions entrypoint and local Express dev adapter.
- [x] 2.5 Update `POST /api/sessions` conflict response to include `code: "PLAYER_RECOVERY_REQUIRED"` while preserving the existing `409 Identity in use` security behavior.

## 3. Frontend Recovery Experience

- [x] 3.1 Add frontend API helpers for player recovery request and verify endpoints, including player-token capture on verify success.
- [x] 3.2 Update setup/assignment launch flow to detect `PLAYER_RECOVERY_REQUIRED` and enter a recovery-required state instead of launching cached local board state.
- [x] 3.3 Add a recovery UI step for requesting a code, entering a code, retrying after rate limits/errors, and cancelling to choose a different identity.
- [x] 3.4 After successful recovery, retry session bootstrap for the same identity and hydrate server board state before allowing tile verification.
- [x] 3.5 Ensure player recovery does not set or clear admin authentication state and does not route through admin login.

## 4. Tests

- [x] 4.1 Add backend unit tests for device-token verification, including legacy `owner_token`, active device token, revoked device token, missing token, and mismatched token cases.
- [x] 4.2 Add backend unit tests for recovery request outcomes: existing player sends code, unknown email returns neutral success, invalid email returns 400, rate limit returns 429, and email send failure is handled.
- [x] 4.3 Add backend unit tests for recovery verify outcomes: valid code issues token/cookie, invalid code returns 401, expired/used code returns 401, and parallel redemption only succeeds once.
- [x] 4.4 Add backend unit tests for `POST /api/sessions` recoverable 409 response shape and device-token-authenticated resume.
- [x] 4.5 Add frontend unit tests for recovery API helpers, setup recovery state, blocked cached-board launch, successful verify/bootstrap retry, and admin-state separation.
- [x] 4.6 Add Playwright coverage for a fresh/private browser context recovering an existing player and loading server-backed board state.

## 5. Verification And Documentation

- [x] 5.1 Run backend Vitest with `npm --prefix backend test` and fix failures related to this change.
- [x] 5.2 Run frontend Vitest with `npm --prefix frontend test` and fix failures related to this change.
- [x] 5.3 Run focused Playwright/e2e coverage for player recovery with `npm --prefix frontend run e2e` or the narrow configured spec command.
- [x] 5.4 Update deployment or support documentation with the player recovery behavior, private-window guidance, and rollback notes.
- [x] 5.5 Verify OpenSpec status and ensure all requirements from the delta specs map to completed tasks before implementation is marked done.