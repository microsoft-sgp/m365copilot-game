## ADDED Requirements

### Requirement: Admin score event achievements display
The system SHALL display Recent Score Events in admin-facing achievement language while preserving the underlying progression event data for API and export compatibility.

#### Scenario: Line score event displays as completed line
- **GIVEN** the dashboard API returns a score event with `event_type` `line_won` and an `event_key` such as `R1`, `C2`, or `D1`
- **WHEN** the admin dashboard renders Recent Score Events
- **THEN** the system MUST display the event as a line completion achievement with a corresponding task-style detail such as `Task 1` or `Task 2` instead of displaying `line_won` or board-geometry terms such as row, column, or diagonal

#### Scenario: Weekly score event displays as weekly award
- **GIVEN** the dashboard API returns a score event with `event_type` `weekly_won` and an `event_key` such as `W1`
- **WHEN** the admin dashboard renders Recent Score Events
- **THEN** the system MUST display the event as a weekly award achievement with the corresponding week detail instead of displaying `weekly_won`

#### Scenario: Legacy score event displays as legacy submission
- **GIVEN** the dashboard API returns a score event row without an `event_type`
- **WHEN** the admin dashboard renders Recent Score Events
- **THEN** the system MUST display the event as a legacy keyword submission instead of displaying a raw fallback code

#### Scenario: Raw score event data remains exportable
- **GIVEN** progression score records include raw event type and event key values
- **WHEN** the admin downloads the CSV export
- **THEN** the system MUST preserve the existing raw export columns and values for audit and reporting compatibility