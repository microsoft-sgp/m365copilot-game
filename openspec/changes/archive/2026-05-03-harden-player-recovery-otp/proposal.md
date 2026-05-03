## Why

Player recovery OTP verification can appear to expire immediately when backend verification fails with a server error, because the frontend falls back to the same "invalid or expired" message used for true code failures. Player recovery emails also use a minimal plaintext-only format while admin OTP emails use the branded HTML and plaintext format, creating an inconsistent and less trustworthy recovery experience.

## What Changes

- Align player recovery email content with the admin OTP email format by sending both branded HTML and plain-text fallback content with the 6-digit code and 10-minute expiry copy.
- Preserve the separate admin OTP and player recovery security boundaries: player recovery must not issue admin auth and admin OTP must not recover player sessions.
- Preserve the existing 10-minute player recovery code TTL and 60-second request cooldown.
- Harden player recovery verification so server-side failures after a valid code is presented do not misleadingly look like immediate expiry to the player.
- Improve frontend recovery error handling so HTTP 5xx or malformed API responses show a retry/service message instead of the invalid-or-expired-code fallback.
- Add focused tests for the aligned email payload and recovery verification failure behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `player-session-auth`: Player recovery code delivery and verification requirements now include admin-aligned branded email content, clearer service-failure behavior, and protection against burning a valid recovery code when token issuance fails.

## Impact

- Backend: `backend/src/lib/email.ts`, player recovery request/verify functions, and related Vitest coverage.
- Frontend: recovery UI/API handling in the setup flow so service failures are not shown as expired codes.
- Database: no planned schema changes; verification may use transaction semantics around existing `player_recovery_otps` and `player_device_tokens` rows.
- APIs: no endpoint shape changes; responses remain JSON and recovery/admin endpoints stay separate.
- Observability: existing non-sensitive recovery request and verify telemetry should remain intact, with no OTP values, player tokens, or raw emails logged.
- Rollback: revert the backend email/verification changes and frontend error-handling changes; existing recovery OTP and device-token tables remain compatible because no schema migration is planned.
- Affected teams: backend, frontend, and operations/support teams triaging player recovery failures.
