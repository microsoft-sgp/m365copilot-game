## Context

The admin dashboard currently renders Recent Sessions as a simple table with raw board-state labels: `Tiles`, `Lines`, and numeric values such as `3/9` and `1`. The adjacent Recent Score Events table has already moved toward admin-facing achievement language, including labels such as `Achievement`, `Award Code`, `Line completed`, and `Task 1`.

The dashboard API already returns the session counts needed for a clearer presentation: `tiles_cleared`, `lines_won`, `pack_id`, and `last_active_at`. The frontend can translate these values without changing the API contract or stored data.

## Goals / Non-Goals

**Goals:**

- Make Recent Sessions easier for campaign administrators to scan.
- Rename visible session-progress language from board mechanics to admin-facing progress terms.
- Show task completion and line-award completion with explicit total context.
- Keep the dashboard API, database schema, and CSV export behavior unchanged.
- Cover the updated labels and progress rendering with focused frontend tests.

**Non-Goals:**

- Change how player progress is calculated.
- Rename `tiles_cleared`, `lines_won`, or other backend fields.
- Add sorting, filtering, drill-down, pagination, or new dashboard endpoints.
- Change the player-facing bingo language in the game HUD or board UI.

## Decisions

### Translate Recent Sessions labels in the admin frontend

The admin dashboard component should translate session progress into reporting language:

| Current label | Admin-facing label | Meaning |
| --- | --- | --- |
| `Tiles` | `Tasks` | Board tasks completed out of 9 |
| `Lines` | `Awards` | Line-based awards earned out of 8 |
| `Avg Tiles` | `Avg Tasks` | Average completed tasks per session |

Rationale: this mirrors the recent score-event display change, keeps the API stable, and avoids leaking board geometry into the admin reporting surface.

Alternative considered: add display fields such as `tasksCompletedLabel` or `awardsEarnedLabel` in the backend response. That would centralize presentation text but expand the API for a dashboard-only copy and layout concern.

### Use explicit progress totals

Recent Sessions should show task completion as `N/9` and award completion as `N/8` because the board has 9 tasks and 8 possible line awards. A compact progress indicator can sit alongside the numeric value so admins can scan status quickly.

Rationale: `Lines 1` is ambiguous, while `Awards 1/8` clearly communicates partial achievement progress. The total values come from the current 3x3 board and line definitions.

Alternative considered: show only labels without totals. That improves terminology but leaves the admin guessing whether a value is good, partial, or complete.

### Keep implementation scoped to presentation

This change should use existing dashboard data and local frontend formatting. Tests should assert the visible labels and progress text rather than implementation-specific CSS classes.

Rationale: the underlying session fields are already accurate and used elsewhere. Keeping this as a presentation change reduces deployment risk and keeps rollback straightforward.

Alternative considered: rename backend fields or database columns. That would be high-churn and unnecessary because the confusion is limited to admin UI wording and layout.

## Risks / Trade-offs

- Board size assumptions drift if the game changes from 3x3 -> keep task and award totals in a small local helper or constants so future updates have one obvious place to change.
- Richer progress UI could reduce table density -> keep the row compact and preserve horizontal scrolling behavior for narrow screens.
- Admin and player language may intentionally differ -> keep this scoped to admin reporting surfaces and do not rename player-facing HUD labels.
- Visual tests may become brittle if they assert CSS details -> prefer unit tests for text and key DOM structure.

## Migration Plan

Deploy the frontend presentation change and tests. No data migration, API change, or configuration update is required. Rollback is a frontend-only revert because raw session counts remain available from the existing dashboard API.

## Open Questions

- None.