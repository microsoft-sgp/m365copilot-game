## MODIFIED Requirements

### Requirement: Players table
The system SHALL store player records in a `players` table keyed by email as the primary identity, with onboarding display name fixed as the canonical player_name and session_id retained for backward compatibility.

#### Scenario: Player created on first session
- **GIVEN** an email that does not exist in the players table
- **WHEN** a new game session is started with that email and onboarding display name
- **THEN** the system MUST insert a player record with email, sessionId, canonical player_name, and created_at timestamp

#### Scenario: Existing player starts subsequent sessions
- **GIVEN** an email that already exists in the players table
- **WHEN** a new game session is started with the same email
- **THEN** the system MUST reuse the existing player record and MUST NOT overwrite canonical player_name from normal gameplay flow

### Requirement: Leaderboard aggregation query
The system SHALL support an aggregation query that computes per-organization ranking from progression-scoring records derived from verified gameplay events, including contributor counts and last scoring timestamp, filtered by campaign_id.

#### Scenario: Leaderboard query returns ranked results
- **GIVEN** multiple progression-scoring records exist across organizations for campaign `APR26`
- **WHEN** the leaderboard aggregation query is executed
- **THEN** the system MUST return organizations ranked by progression score descending, with contributor count and last scoring time

### Requirement: Migration scripts in database folder
The system SHALL provide numbered SQL migration scripts in the `database/` folder for creating tables, seeding data, and introducing progression-scoring schema changes.

#### Scenario: Progression scoring migration applied
- **GIVEN** an existing database initialized with prior migrations
- **WHEN** the new progression-scoring migration runs
- **THEN** the system MUST create required schema/index changes without data loss for existing players, sessions, submissions, and events

## ADDED Requirements

### Requirement: Progression scoring records table
The system SHALL persist score-bearing progression events in a dedicated table keyed for idempotency and leaderboard aggregation.

#### Scenario: Idempotent score record for line completion
- **GIVEN** a player has already received score for a specific line completion in a campaign
- **WHEN** the same scoring event is processed again
- **THEN** the system MUST prevent duplicate score records for that event identity

#### Scenario: Score record linked to org and player
- **GIVEN** a score-bearing progression event is accepted
- **WHEN** the score record is inserted
- **THEN** the system MUST store campaign, player, organization, event type, event identity, and timestamp fields needed for leaderboard and activity views

## REMOVED Requirements

### Requirement: Submissions table
**Reason**: Submission records are no longer the primary leaderboard source.

**Migration**: Keep `submissions` as legacy/rollback-compatible data during transition, but shift leaderboard reads to progression-scoring records and phase out submission-only aggregation.
