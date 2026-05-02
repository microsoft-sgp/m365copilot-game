## ADDED Requirements

### Requirement: Organization leaderboard displays score and contributors clearly

The system SHALL display organization leaderboard rows with distinct visible metrics for rank, score, and contributor count. The score metric SHALL be the visible numeric metric associated with leaderboard rank order, and contributor count MUST be labeled explicitly rather than shown as an ambiguous `#` column.

#### Scenario: Leaderboard renders score and contributor metrics

- **GIVEN** the frontend receives leaderboard rows containing `score`, `contributors`, and `lastSubmission`
- **WHEN** the organization leaderboard renders on the Activity or submission leaderboard view
- **THEN** each row MUST display rank, organization, score, contributor count, and last submission where the viewport supports the timestamp column

#### Scenario: Score explains rank when contributor count differs

- **GIVEN** one organization has a higher score but fewer contributors than another organization
- **WHEN** the organization leaderboard renders the server-provided ranking
- **THEN** the higher-score organization MUST appear above the lower-score organization and the visible score values MUST make the ordering understandable

#### Scenario: Contributor column is explicitly labeled

- **GIVEN** the organization leaderboard has at least one row
- **WHEN** the table headers render
- **THEN** the contributor metric MUST be labeled as contributors or an unambiguous abbreviation, and MUST NOT be labeled only as `#`