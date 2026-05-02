## Why

The organization leaderboard ranks rows by progression score, but the visible `#` column currently shows contributor count without a clear label. This makes a row with more contributors appear as though it should outrank a row with fewer contributors, even when the hidden score metric correctly determines rank.

## What Changes

- Update the player-facing organization leaderboard to make the score metric visible and clearly associated with rank order.
- Show contributor count as a distinct, explicitly labeled metric rather than an ambiguous `#` column.
- Preserve the existing `GET /api/leaderboard` response shape and score-based ranking semantics.
- Update frontend tests to cover score and contributor display together.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bingo-frontend`: The leaderboard display requirements will clarify that visible columns must distinguish rank, score, and contributor count.

## Impact

- Affected code: `frontend/src/components/LeaderboardTable.vue`, `frontend/src/composables/useSubmissions.ts` tests, and leaderboard component tests.
- Affected APIs: None; the existing leaderboard API already exposes `score`, `contributors`, and `lastSubmission`.
- Affected teams: Frontend/game experience and QA.
- Rollback plan: Revert the frontend display and test updates; no database, API, or data migration rollback is required.