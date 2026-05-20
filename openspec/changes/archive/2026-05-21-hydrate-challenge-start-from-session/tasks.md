## 1. Hydration Fallback

- [x] 1.1 Update `ServerPlayerState.activeSession` typing in `frontend/src/composables/useBingoGame.ts` to include `startedAt` from `POST /api/player/state`.
- [x] 1.2 Add a timestamp parser that accepts valid millisecond numbers and backend date strings, returning `null` for missing or invalid values.
- [x] 1.3 Extend challenge-profile normalization to accept a fallback start timestamp and create or repair a profile when `challengeStartAt` is missing or invalid.
- [x] 1.4 Update `hydrateFromServer` to pass `activeSession.startedAt` into normalization and prefer it over a fresh local profile when the server board state lacks a usable challenge start.
- [x] 1.5 Confirm weekly submissions, weekly keywords, and `weeksCompleted` remain award-based and are not backfilled from elapsed time.

## 2. Frontend Coverage

- [x] 2.1 Add a unit test proving a server-hydrated board with no `challengeProfile` uses `activeSession.startedAt` and opens Week 2 after seven elapsed days.
- [x] 2.2 Add a unit test proving a missing or invalid `challengeStartAt` is repaired from `activeSession.startedAt` during hydration.
- [x] 2.3 Add a unit test proving an older server `startedAt` takes precedence over a freshly-created local challenge profile when the server payload lacks a usable profile start.
- [x] 2.4 Add or adjust assertions to prove `weeklySubmissions` remains empty and `weeksCompleted` remains unchanged after fallback-only hydration.

## 3. Verification

- [x] 3.1 Recheck lockfiles for the TanStack advisory before running commands that could touch dependencies; do not run `npm install` or dev servers as part of this change.
- [x] 3.2 Run the focused frontend Vitest suite for `frontend/src/composables/useBingoGame.test.js` without refreshing dependencies.
- [x] 3.3 Run OpenSpec validation/status for `hydrate-challenge-start-from-session` and confirm the change remains apply-ready.