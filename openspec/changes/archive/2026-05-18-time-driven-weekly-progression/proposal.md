## Why

Players can remain stuck on Week 1 after the board has been active for more than seven days because the current week only advances when a weekly clear is awarded. Weekly challenge availability should match elapsed time since the board started, so Week 2 opens automatically after seven days even if Week 1 was not completed.

## What Changes

- Derive the active challenge week from `challengeStartAt` and elapsed weekly intervals, capped by the campaign week count.
- Normalize restored and server-hydrated challenge profiles so stale `currentWeek` values catch up when the player returns.
- Award weekly clear keywords for the currently open timed week, without requiring previous weeks to be completed first.
- Preserve existing line-clear, board persistence, and cycle-completion behavior; no breaking API or database changes are expected.
- Rollback plan: revert the frontend challenge-profile normalization and weekly-award logic to the previous event-driven advancement behavior if issues appear.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bingo-frontend`: Weekly challenge progression must open weeks based on elapsed time since board start, independently of whether earlier weekly clears were completed.

## Impact

- Frontend game state in `frontend/src/composables/useBingoGame.ts`.
- Frontend unit tests for weekly progression, hydration, and challenge display.
- Persisted `boardState.challengeProfile` values may be normalized on load or hydration, but the storage shape remains unchanged.
- Backend APIs and Azure SQL schema are not expected to change.
- Affected teams: event/player experience owners and leaderboard/admin operators who interpret weekly award timing.
