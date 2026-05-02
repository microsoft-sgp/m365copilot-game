## 1. Admin Session Progress UI

- [x] 1.1 Define local display constants or helpers for the 9 task total and 8 award total used by Recent Sessions.
- [x] 1.2 Rename the dashboard summary label from `Avg Tiles` to `Avg Tasks` while continuing to read `avgTilesCleared` from the existing API response.
- [x] 1.3 Update the Recent Sessions table headers from `Tiles` and `Lines` to `Tasks` and `Awards`.
- [x] 1.4 Render each session's task progress with clear `N/9` text and a compact progress indicator.
- [x] 1.5 Render each session's award progress with clear `N/8` text and a compact progress indicator.
- [x] 1.6 Keep the dashboard API contract unchanged, continuing to consume `tiles_cleared`, `lines_won`, `pack_id`, and `last_active_at`.

## 2. Tests and Verification

- [x] 2.1 Update `AdminDashboard` unit coverage to assert the new `Tasks`, `Awards`, `Avg Tasks`, `3/9`, and `1/8` display behavior.
- [x] 2.2 Update tests to guard against the old `Tiles`, `Lines`, and `Avg Tiles` labels in Recent Sessions and summary UI.
- [x] 2.3 Run `npm test -- AdminDashboard` from `frontend/` and confirm the relevant Vitest suite passes.