## Why

Existing players can still appear stuck on Week 1 when their restored `board_state` is missing `challengeProfile` or has a missing/invalid `challengeStartAt`. The backend already returns `activeSession.startedAt`, so the frontend can recover the board-start anchor without a schema change and keep time-driven weekly availability working for older rows.

## What Changes

- Hydrate server-restored boards with a valid challenge profile when `boardState.challengeProfile` is absent or incomplete.
- Use `activeSession.startedAt` as the fallback `challengeStartAt` during server hydration before computing the open week.
- Preserve completion semantics: `weeksCompleted` and `weeklySubmissions` remain based on earned weekly clears, with no automatic backfill of missed weeks or keywords.
- Add focused frontend coverage for old `board_state` shapes, invalid/missing `challengeStartAt`, and local profile values that should not override an older server session start.
- Keep supply-chain safety in mind during verification: do not run package-manager install commands or dev servers unless the TanStack advisory risk has been rechecked.
- Rollback plan: revert the hydration fallback and tests. Existing persisted state remains compatible because no storage shape, API route, or SQL schema change is introduced.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bingo-frontend`: Server-hydrated weekly challenge progression must recover missing or invalid `challengeStartAt` from the active session start time.

## Impact

- Frontend game state hydration in `frontend/src/composables/useBingoGame.ts`.
- Frontend unit tests in `frontend/src/composables/useBingoGame.test.js`.
- No expected backend API, Azure SQL schema, lockfile, or dependency changes.
- Affected teams: player experience owners, event operations, and support/admin operators helping existing users resume boards.