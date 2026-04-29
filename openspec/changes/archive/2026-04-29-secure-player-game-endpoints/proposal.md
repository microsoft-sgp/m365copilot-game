## Why

Five public, anonymous game endpoints (`POST /api/sessions`, `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, `GET /api/player/state`) currently trust client-supplied integer IDs and emails. Combined with sequential, enumerable IDs, this lets any unauthenticated visitor:

- Drive the leaderboard score for any organization by fabricating `gameSessionId` + `eventType: "line_won"` posts (`H1`).
- Hijack any other player's `players.session_id` via the email-keyed `MERGE` in `createSession` (`H1`).
- Confirm participation and exfiltrate game state for arbitrary emails through `getPlayerState` (`H2`).
- Permanently consume a victim's unique-keyword submission slot by submitting under their email (`H1`).

This is the highest-impact gap left after the April 2026 security review remediation pass; the remaining findings are defence-in-depth, while these are exploitable today against the live leaderboard.

## What Changes

- **BREAKING (server)**: `POST /api/sessions` now MUST return an opaque, server-generated `playerToken` (random 32-byte URL-safe string) alongside the existing fields, and MUST set it as an HttpOnly cookie scoped to `/api`.
- **BREAKING (server)**: `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, and `GET /api/player/state` MUST require the `playerToken` (from cookie or `X-Player-Token` header) and MUST verify it belongs to the player owning the addressed session/email. Requests without a matching token return `401 Unauthorized`.
- New database column `players.owner_token NVARCHAR(64)` (nullable for backward compatibility; populated on first authenticated `createSession`/`submitKeyword` call).
- New database migration `009-player-owner-token.sql`.
- `getPlayerState` MUST require the player to prove ownership of the requested email; unauthenticated callers receive `404` with the same shape as a missing player so existence cannot be probed.
- Public game IDs (`gameSessionId`, `playerId`) remain integers in the database, but server responses MUST NOT echo `playerId`; `gameSessionId` continues to be returned because legacy clients depend on it. The owner-token check makes ID enumeration non-exploitable without changing the schema.
- Frontend MUST persist `playerToken` (HttpOnly cookie is preferred; the SPA falls back to `sessionStorage` only when cookies are unavailable, e.g. Safari ITP), and MUST send it on every game API call.
- E2E playwright suite MUST cover the new auth path (token issued on session create, accepted on subsequent calls, rejected when missing or mismatched).

## Capabilities

### New Capabilities
- `player-session-auth`: server-issued opaque token bound to a player record, used to authorise mutating game endpoints and personal state retrieval.

### Modified Capabilities
- `game-api`: requirements added for `playerToken` issuance on session creation and enforcement on `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, and `GET /api/player/state`.
- `game-database`: requirement added for `players.owner_token` storage.
- `player-identity`: requirement added for client-side persistence of `playerToken` and inclusion on subsequent API calls.

## Impact

- **Affected code**:
  - `backend/src/lib/playerAuth.ts` (new): token generation, hashing for storage, constant-time comparison helpers.
  - `backend/src/functions/createSession.ts`, `submitKeyword.ts`, `recordEvent.ts`, `updateSession.ts`, `getPlayerState.ts`: token issuance + enforcement.
  - `backend/src/functions/http.ts` (or new `playerCookies.ts`): cookie helpers mirroring `adminCookies.ts`.
  - `database/009-player-owner-token.sql` (new), `scripts/init-db.mjs`, `backend/scripts/run-migrations.mjs`.
  - `frontend/src/lib/api.ts`: include `credentials: 'include'` (already does) and forward `X-Player-Token` from storage when needed.
  - `frontend/src/composables/useBingoGame.ts`, `useSubmissions.ts`, `App.vue`: persist token from `createSession` / `getPlayerState` responses.
- **APIs**: response shape of `POST /api/sessions` gains `playerToken`; `GET /api/player/state` becomes auth-required for matching email.
- **Dependencies**: no new packages — uses `node:crypto` for token generation/hashing; reuses Redis only if we choose to short-circuit token lookups in cache.
- **Systems**: requires database migration; deploy order MUST be migration → backend → frontend so legacy frontends keep working during rollout (token is optional on first create until backfill completes; see design.md).
- **Affected teams**: backend/API, frontend SPA, infra/migrations.

### Rollback plan

1. Feature-flag the enforcement via `ENABLE_PLAYER_TOKEN_ENFORCEMENT` env var (read in each handler). Default `true` after rollout, `false` during the gap.
2. If a regression is detected, set the flag to `false` in the Function App app settings; handlers fall back to legacy behaviour without redeploying. Token issuance continues so the column gets populated for next attempt.
3. The migration is additive (new nullable column, no default backfill), so no schema rollback is required if the change is disabled.
4. Worst case: drop column with `010-revert-player-owner-token.sql` (provided alongside the forward migration but uncommitted/unrun unless needed).
