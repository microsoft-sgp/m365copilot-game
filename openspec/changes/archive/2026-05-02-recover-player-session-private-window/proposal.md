## Why

Players using private windows, new browsers, or cookie-restricted sessions can lose the player ownership token while still knowing their email, causing `POST /api/sessions` to return `409 Identity in use` and leaving recoverable players unable to resume server-backed progress. The game already stores board state in Azure SQL, so the missing capability is a secure player recovery path that re-proves email ownership and reissues player proof without weakening takeover protection.

## What Changes

- Add a player-session recovery flow for existing emails that reach the `Identity in use` branch without a matching player token.
- Introduce player recovery OTP or magic-code endpoints that verify email ownership before issuing a new player token.
- Allow recovered players to hydrate their existing pack assignment, game session, and board state from Azure SQL after successful verification.
- Preserve SQL as the durable source of truth for player, assignment, board, event, and scoring data; Redis MAY be used only for short-lived recovery throttling/challenge state and MUST NOT become the durable game-state store.
- Update the frontend to treat recoverable 409 responses as an identity-recovery state instead of allowing confusing local-only play to continue.
- Keep admin OTP and player recovery separate so an admin can also be a player, but admin authorization does not unlock player recovery and player recovery does not grant admin access.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `player-session-auth`: Adds verified player-token recovery/reissue behavior for existing players who lack the matching token in a new/private browser context.
- `player-identity`: Adds frontend recovery UX and hydration expectations when an entered email belongs to an existing player but the browser lacks ownership proof.
- `game-api`: Adds or modifies API behavior for recoverable session conflicts and player recovery verification endpoints.

## Impact

- **Code**: likely touches [backend/src/functions/createSession.ts](backend/src/functions/createSession.ts), new or existing backend player recovery functions, [backend/src/lib/playerAuth.ts](backend/src/lib/playerAuth.ts), [backend/src/lib/email.ts](backend/src/lib/email.ts), [backend/src/lib/cache.ts](backend/src/lib/cache.ts), [frontend/src/lib/api.ts](frontend/src/lib/api.ts), [frontend/src/App.vue](frontend/src/App.vue), setup/onboarding components, and related tests.
- **APIs**: `POST /api/sessions` should surface a recoverable identity-conflict response; new player recovery request/verify endpoints may be added under the game API surface.
- **Database**: may add a `player_recovery_otps` table or a `player_device_tokens` table if multi-device tokens are chosen in design; existing `game_sessions.board_state` remains the durable board-state store.
- **Cache**: Redis may be used for recovery rate limits or short-lived challenge counters, with SQL still required for correctness.
- **Dependencies**: no new third-party dependency expected; existing Azure Communication Services email path can be reused.
- **Rollback**: disable or remove the recovery endpoints and frontend recovery prompt; existing player tokens, board state, assignments, and admin sessions remain valid. If a migration is added, keep it additive so rollback can ignore unused recovery/device-token rows without destructive data changes.
- **Affected teams**: backend (player token and recovery handlers), frontend (recovery UX and local-state gating), ops (email deliverability/rate-limit monitoring, optional Redis challenge telemetry), event admins/support (player recovery guidance).