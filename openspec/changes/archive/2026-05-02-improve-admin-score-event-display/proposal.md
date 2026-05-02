## Why

The admin dashboard currently exposes raw score event identifiers such as `line_won` and `weekly_won` in the Recent Score Events table. These values are accurate for storage and APIs, but they read like implementation details and make it harder for campaign administrators to understand what a player actually achieved.

## What Changes

- Replace raw event-code display in the admin Recent Score Events table with human-readable achievement labels.
- Show award-specific detail, such as `Task 1`, `Task 2`, or `Week 1`, when the event data provides enough context.
- Rename score-event table language from implementation-oriented terms toward admin-facing reporting terms, such as `Achievement` and `Award Code`.
- Preserve raw event data in backend responses and CSV exports so audit/reporting compatibility is maintained.
- Add frontend tests covering friendly score event labels and detail rendering.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `admin-dashboard`: Recent score events must render admin-friendly achievement labels and contextual award details instead of raw progression event codes.

## Impact

- Affected teams: campaign administrators, frontend maintainers, backend/API maintainers, QA.
- Frontend: `AdminDashboard.vue` score events table presentation and associated tests.
- Backend/API: no required schema or contract change; existing `event_type`, `event_key`, `keyword`, and timestamp fields remain available.
- CSV export: remains raw/progression-compatible for audit and reporting workflows.
- Rollback plan: revert the frontend label/detail formatting and table heading changes; raw event codes remain available from the existing dashboard API.