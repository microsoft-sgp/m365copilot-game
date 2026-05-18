## 1. Weekly Progression Logic

- [x] 1.1 Add a challenge-profile normalization helper in `frontend/src/composables/useBingoGame.ts` that computes the open week from `challengeStartAt`, `MS_PER_WEEK`, and `TOTAL_WEEKS`.
- [x] 1.2 Normalize `challengeProfile.currentWeek` after local state load, after board initialization/reset, and after server hydration so stale profiles catch up before rendering.
- [x] 1.3 Update `tryWeeklyClear()` to normalize before checking `weeklySubmissions`, mint the currently open timed week, and preserve `weeksCompleted` as the count of awarded weekly submissions.
- [x] 1.4 Preserve the existing challenge-profile storage shape and avoid backend API or database changes.

## 2. Frontend Tests

- [x] 2.1 Add a `useBingoGame` unit test proving Week 2 opens after seven elapsed days even when Week 1 was not completed.
- [x] 2.2 Add a hydration unit test proving a stale restored `currentWeek` catches up before the board renders.
- [x] 2.3 Add a weekly-award unit test proving a player in timed Week 2 receives a Week 2 keyword without backfilling Week 1.
- [x] 2.4 Keep existing weekly progression and duplicate-award tests passing, including total-week capping.

## 3. Verification

- [x] 3.1 Run the frontend Vitest suite with `npm test` from `frontend/`.
- [x] 3.2 Run frontend type checking with `npm run typecheck` from `frontend/`.
- [x] 3.3 Confirm `openspec validate time-driven-weekly-progression --strict` passes before marking implementation complete.
