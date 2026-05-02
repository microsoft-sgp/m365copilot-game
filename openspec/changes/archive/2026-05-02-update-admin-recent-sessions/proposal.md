## Why

The admin Recent Sessions table still exposes board-mechanics language such as `Tiles` and `Lines`, while nearby score reporting has already moved toward admin-facing achievement language. This makes player progress harder to scan and creates a mismatch between session progress and score-event reporting.

## What Changes

- Rename Recent Sessions progress terminology from raw board terms to admin-facing labels, using `Tasks` for completed board tiles and `Awards` for completed scoring lines.
- Present task progress as a clearer `completed / total` progress indicator instead of a plain numeric table cell.
- Present line-award progress with explicit total context so admins can distinguish task completion from award completion.
- Update related dashboard summary copy such as `Avg Tiles` to match the new task-oriented language.
- Preserve the existing dashboard API response fields and raw database column names for compatibility.
- Add or update focused frontend coverage for the new labels and progress rendering.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `admin-dashboard`: Recent Sessions must render session progress using admin-facing task and award language with a richer, scan-friendly presentation.

## Impact

- Affected teams: campaign administrators, frontend maintainers, QA.
- Frontend: `AdminDashboard.vue` Recent Sessions table presentation and associated unit tests.
- Backend/API: no required contract change; existing `tiles_cleared`, `lines_won`, `pack_id`, and timestamp fields remain available.
- Database: no schema change.
- CSV export: no change.
- Rollback plan: revert the frontend label and progress-presentation changes; the underlying dashboard API and stored session data remain unchanged.