## ADDED Requirements

### Requirement: Admin session progress display
The system SHALL display Recent Sessions progress in admin-facing task and award language while preserving the underlying dashboard API fields for compatibility.

#### Scenario: Recent Sessions displays task progress
- **GIVEN** the dashboard API returns a recent session with `tiles_cleared` set to `3`
- **WHEN** the admin dashboard renders Recent Sessions
- **THEN** the system MUST display the session progress using a `Tasks` label with `3/9` task progress instead of a `Tiles` label

#### Scenario: Recent Sessions displays award progress
- **GIVEN** the dashboard API returns a recent session with `lines_won` set to `1`
- **WHEN** the admin dashboard renders Recent Sessions
- **THEN** the system MUST display the line-award progress using an admin-facing `Awards` label with explicit `1/8` total context instead of a `Lines` label with only the raw count

#### Scenario: Dashboard summary uses task language
- **GIVEN** the dashboard summary includes `avgTilesCleared`
- **WHEN** the admin dashboard renders summary metrics
- **THEN** the system MUST label the average completed-board metric as tasks rather than tiles

#### Scenario: Session API compatibility is preserved
- **GIVEN** the dashboard API returns existing session fields such as `tiles_cleared`, `lines_won`, `pack_id`, and `last_active_at`
- **WHEN** the admin dashboard renders Recent Sessions
- **THEN** the system MUST use those existing fields without requiring a backend response contract change