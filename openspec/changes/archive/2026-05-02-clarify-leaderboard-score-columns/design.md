## Context

The backend leaderboard endpoint already returns separate `score` and `contributors` fields and sorts organizations by score descending. The Vue leaderboard component currently renders rank from row order but displays only contributor count under a terse `#` column, so the visible table does not explain why one organization outranks another.

This change is limited to the player-facing frontend display and tests. The API response shape, database aggregation, cache behavior, and ranking semantics remain unchanged.

## Goals / Non-Goals

**Goals:**

- Make progression score visible in the organization leaderboard.
- Label contributor count explicitly so it cannot be mistaken for rank or score.
- Preserve score-based ordering from `GET /api/leaderboard`.
- Keep the table usable on compact viewports by maintaining the existing responsive treatment for less critical timestamp data.

**Non-Goals:**

- Change the backend leaderboard query, score calculation, contributor calculation, or cache keys.
- Re-rank organizations by contributor count.
- Add new leaderboard APIs or database fields.
- Redesign the broader Activity tab layout.

## Decisions

1. Display both score and contributors as first-class columns.
   - Rationale: Rank is based on score, while contributors are useful supporting context. Showing both removes the hidden-metric ambiguity.
   - Alternative considered: Rename `#` to `Contributors` only. Rejected because rank would still depend on a metric not visible in the table.

2. Continue deriving displayed rows from the existing `useSubmissions` mapping.
   - Rationale: The composable already maps server `score` to local `count` and server `contributors` to `contributorCount`, so the component can render both without API changes.
   - Alternative considered: Rename the internal `count` field to `score`. Deferred to implementation judgment because the display fix can remain minimal, but tests should make the score meaning clear.

3. Preserve existing server-provided ordering rather than sorting again in the table.
   - Rationale: `GET /api/leaderboard` is the source of truth for campaign ranking. The component should explain that order, not recompute it.
   - Alternative considered: Sort by the visible contributor count. Rejected because it conflicts with the leaderboard contract and would change game semantics.

## Risks / Trade-offs

- Additional table column may crowd narrow screens -> Keep `Last Submission` hidden on compact viewports and use concise column labels where needed.
- Internal naming (`count`) may continue to obscure score semantics for maintainers -> Cover the score/contributor distinction in tests and consider a small internal rename only if it stays low-risk during implementation.
- Users may still wonder how score is earned -> Activity text already states score comes from verified gameplay progression; avoid adding explanatory UI copy unless testing shows the table remains unclear.

## Migration Plan

- Update the leaderboard component and associated tests in one frontend-only change.
- Run focused frontend unit tests for `LeaderboardTable` and `useSubmissions`.
- Roll back by reverting the component/test changes; no API, database, or cache migration is required.

## Open Questions

- None.