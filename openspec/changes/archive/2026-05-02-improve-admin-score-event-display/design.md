## Context

Recent Score Events currently renders `event_type` directly from the dashboard API. Values such as `line_won` and `weekly_won` are useful internal progression codes, but they are not meaningful reporting language for campaign administrators.

The dashboard API already returns the data needed for a better display: `event_type`, `event_key`, `keyword`, and `created_at`. Task-style award and week details can be derived from `event_key` when present, with the keyword available as a fallback source for recognizable award tokens.

```text
Player action
  -> progression_scores row
  -> admin dashboard API
  -> Recent Score Events table
       raw code today: line_won
      admin label:    Line completed - Task 1
```

## Goals / Non-Goals

**Goals:**

- Render score events in admin-facing language instead of raw implementation codes.
- Show concise award detail for task-style line awards and weekly awards.
- Preserve the existing dashboard API shape and CSV export behavior.
- Cover the label and detail formatting with focused frontend unit tests.

**Non-Goals:**

- Change progression scoring semantics or leaderboard aggregation.
- Rename stored `event_type` values or migrate historical score records.
- Change CSV export headers or raw audit values.
- Add filtering, sorting, or drill-down behavior to the dashboard table.

## Decisions

### Format labels in the admin frontend

The admin dashboard component, or a small helper used by it, will translate known event codes into display metadata:

| Raw value | Label | Detail source |
| --- | --- | --- |
| `line_won` | `Line completed` | `event_key` such as `R1`, `C2`, or `D1` displayed as `Task N` |
| `weekly_won` | `Weekly award earned` | `event_key` such as `W1` |
| missing event type | `Legacy keyword submission` | none |
| unknown event type | friendly title-cased fallback | raw value available only as fallback text |

Rationale: the confusion is presentational, and the current API already carries enough structured data for the display. Keeping formatting in the frontend avoids a backend contract change for a small copy/UX improvement.

Alternative considered: add `event_label` and `event_detail` to the backend response. This would centralize formatting but would expand the API contract and still require frontend presentation changes. It can be revisited later if multiple clients need identical labeling.

### Prefer `event_key` for award detail

The display will prefer `event_key` because it is already the scoring identity used for idempotency. For line awards, the admin UI will hide board-geometry language and map each supported line key to a task-style award number:

| Event key | Detail |
| --- | --- |
| `R1`, `R2`, `R3` | `Task 1`, `Task 2`, `Task 3` |
| `C1`, `C2`, `C3` | `Task 4`, `Task 5`, `Task 6` |
| `D1`, `D2` | `Task 7`, `Task 8` |
| `W1` through `W7` | `Week 1` through `Week 7` |

If `event_key` is absent, the display may omit detail rather than guessing from malformed or incomplete data.

Alternative considered: parse all detail from `keyword`. This is less direct and couples the UI to token formatting, so it should only be a fallback if needed.

This numbering is only a display alias for admins; it does not change the scoring identity or imply that a line award maps to a single board tile.

### Rename visible table terminology

The score-event table should use admin reporting language:

- `Event` becomes `Achievement`.
- `Keyword` becomes `Award Code`.
- `Awarded` can remain or become `Awarded At` for clarity.

Rationale: the table is showing awarded score events, not developer events.

## Risks / Trade-offs

- Unknown event codes display awkwardly -> provide a readable fallback instead of blank output.
- Future event types need label updates -> keep the mapping small and isolated so adding an event type is low cost.
- CSV and UI labels differ -> explicitly preserve CSV raw values for audit/reporting while making the interactive admin view easier to scan.
- Event rows without `event_key` lose detail -> show the main label and avoid inferring unsupported detail.

## Migration Plan

No database migration is required. Deploy the frontend presentation change and associated tests. Rollback is a frontend-only revert because raw event values remain present in the dashboard API.

## Open Questions

- Should future CSV exports add separate friendly-label columns while keeping the raw columns? This change intentionally leaves CSV unchanged.