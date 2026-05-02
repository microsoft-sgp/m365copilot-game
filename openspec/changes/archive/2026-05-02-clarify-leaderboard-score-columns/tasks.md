## 1. Frontend Display

- [x] 1.1 Ensure leaderboard row data exposes the server score and contributor count clearly to the component.
- [x] 1.2 Update `LeaderboardTable` to render distinct Score and Contributors columns instead of an ambiguous `#` column.
- [x] 1.3 Preserve existing rank display and server-provided ordering while keeping Last Submission responsive on compact viewports.

## 2. Verification

- [x] 2.1 Update `LeaderboardTable` unit tests to assert Score and Contributors headers and values render distinctly.
- [x] 2.2 Add or update test coverage for the case where a higher-score organization has fewer contributors than a lower-score organization.
- [x] 2.3 Run the focused frontend Vitest coverage for `LeaderboardTable` and `useSubmissions` before marking implementation tasks complete.