## MODIFIED Requirements

### Requirement: Players table

The system SHALL store player records in a `players` table keyed by email as the primary identity, with onboarding nickname fixed as the canonical `player_name` value and session_id retained for backward compatibility.

#### Scenario: Player created on first session

- **GIVEN** an email that does not exist in the players table
- **WHEN** a new game session is started with that email and onboarding nickname
- **THEN** the system MUST insert a player record with email, sessionId, canonical `player_name`, and created_at timestamp

#### Scenario: Existing player starts subsequent sessions

- **GIVEN** an email that already exists in the players table
- **WHEN** a new game session is started with the same email
- **THEN** the system MUST reuse the existing player record and MUST NOT overwrite canonical `player_name` from normal gameplay flow

#### Scenario: Player upserted by sessionId (backward compatibility)

- **GIVEN** a sessionId that already exists in the players table but no email is provided
- **WHEN** a new game session is started with the same sessionId
- **THEN** the system MUST reuse the existing player record without creating a duplicate

### Requirement: Leaderboard aggregation query

The system SHALL support an aggregation query that computes per-organization ranking from progression-scoring records derived from verified gameplay events, including contributor counts, top contributor nicknames, hidden contributor counts, and last scoring timestamp, filtered by campaign_id.

#### Scenario: Leaderboard query returns ranked results

- **GIVEN** multiple progression-scoring records exist across organizations for campaign `APR26`
- **WHEN** the leaderboard aggregation query is executed
- **THEN** the system MUST return organizations ranked by progression score descending, with contributor count, top contributor nicknames, hidden contributor count, and last scoring time

#### Scenario: Contributor nickname ranking is deterministic

- **GIVEN** multiple players have score-bearing progression records for the same organization and campaign
- **WHEN** top contributor nicknames are calculated for that organization
- **THEN** the system MUST order contributors by contribution count descending, most recent contribution descending, and nickname ascending for any remaining tie

## ADDED Requirements

### Requirement: Student Ambassador referral persistence
The system SHALL persist Student Ambassador referral codes and player referral attribution using additive database structures that do not alter existing scoring records.

#### Scenario: Referral catalog migration creates lookup table
- **GIVEN** the referral migration is applied to a database without referral tables
- **WHEN** the migration completes
- **THEN** the system MUST provide a table for Student Ambassador referral codes with campaign, display name, referral code, active status, and timestamp fields

#### Scenario: Player referral migration creates attribution table
- **GIVEN** the referral migration is applied to a database without referral attribution
- **WHEN** the migration completes
- **THEN** the system MUST provide a table linking players to Student Ambassador referral codes by campaign without modifying progression score totals

#### Scenario: Referral migrations are idempotent
- **GIVEN** the referral migration has already been applied
- **WHEN** the migration is run again
- **THEN** the system MUST complete successfully without duplicating tables, indexes, or constraints
