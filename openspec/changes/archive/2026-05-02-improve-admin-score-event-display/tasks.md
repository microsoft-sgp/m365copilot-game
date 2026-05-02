## 1. Score Event Formatting

- [x] 1.1 Add a small admin score-event formatter that maps known `event_type` values to friendly achievement labels.
- [x] 1.2 Map line score `event_key` values to task-style award details such as `Task 1` and `Task 2`, and map weekly keys to `Week N` details.
- [x] 1.3 Provide readable fallback output for legacy records and unknown event types without displaying raw codes as the primary label.

## 2. Admin Dashboard UI

- [x] 2.1 Update the Recent Score Events table heading from `Event` to admin-facing achievement language.
- [x] 2.2 Render friendly achievement labels and award details in the score events table.
- [x] 2.3 Rename the visible keyword column to `Award Code` while preserving displayed keyword values.
- [x] 2.4 Keep CSV export behavior unchanged.

## 3. Tests and Verification

- [x] 3.1 Add or update frontend Vitest coverage for `line_won`, `weekly_won`, legacy, and unknown score event display cases.
- [x] 3.2 Verify the dashboard still renders summary cards, sessions, score events, and CSV export controls.
- [x] 3.3 Run the relevant frontend Vitest suite before marking implementation complete.