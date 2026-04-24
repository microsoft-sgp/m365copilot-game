# game-database

## Purpose

Defines the Azure SQL database schema for the Copilot Chat Bingo game: tables for organizations, domain mappings, players, game sessions, tile events, and submissions, along with migration scripts and performance indexes.

## Requirements

### Requirement: Organizations table
The system SHALL store organization records in an `organizations` table with a unique name identifier.

#### Scenario: Organization record exists
- **GIVEN** the database is initialized
- **WHEN** a query fetches an organization by name
- **THEN** the system MUST return the organization's id and name

### Requirement: Organization domain mapping table
The system SHALL store email-domain-to-organization mappings in an `org_domains` table supporting many-to-one relationships (multiple domains per org).

#### Scenario: Multiple domains map to one organization
- **GIVEN** the organization "MOE" is seeded with domains "schools.gov.sg" and "students.edu.sg"
- **WHEN** a lookup is performed for either domain
- **THEN** the system MUST resolve both to the same organization id

#### Scenario: Domain not found
- **GIVEN** an email domain that is not in the org_domains table
- **WHEN** a domain lookup is performed
- **THEN** the system MUST return no result, allowing the API to fall back to a manually provided org name

### Requirement: Players table
The system SHALL store player records in a `players` table keyed by email as the primary identity, with session_id retained for backward compatibility.

#### Scenario: Player created on first session
- **GIVEN** an email that does not exist in the players table
- **WHEN** a new game session is started with that email
- **THEN** the system MUST insert a player record with the email, sessionId, playerName, and created_at timestamp

#### Scenario: Player upserted by email on subsequent sessions
- **GIVEN** an email that already exists in the players table
- **WHEN** a new game session is started with the same email
- **THEN** the system MUST reuse the existing player record, updating the player_name if changed, without creating a duplicate

#### Scenario: Player upserted by sessionId (backward compatibility)
- **GIVEN** a sessionId that already exists in the players table but no email is provided
- **WHEN** a new game session is started with the same sessionId
- **THEN** the system MUST reuse the existing player record without creating a duplicate

### Requirement: Game sessions table
The system SHALL store game session records in a `game_sessions` table tracking which player started which pack, with summary counters and full board state for cross-device sync.

#### Scenario: Game session created on board start
- **GIVEN** a player starts a new board with a packId
- **WHEN** the session creation endpoint is called
- **THEN** the system MUST insert a game_sessions record with player_id, pack_id, campaign_id, initial counters set to zero, and board_state set to null

#### Scenario: Session progress updated with board state
- **GIVEN** a game session exists
- **WHEN** the session update endpoint is called with counter values and boardState
- **THEN** the system MUST update tiles_cleared, lines_won, keywords_earned, board_state, and set last_active_at to the current UTC time

#### Scenario: Board state stored as JSON
- **GIVEN** a game session is updated with board state
- **WHEN** the board_state column is written
- **THEN** the value MUST be a JSON string containing `{ cleared: boolean[], wonLines: string[], keywords: object[], challengeProfile: object }` stored in an NVARCHAR(MAX) column

#### Scenario: Unique constraint on player-pack-campaign
- **GIVEN** a player has already started a session with the same pack_id and campaign_id
- **WHEN** a duplicate session creation is attempted
- **THEN** the system MUST enforce the unique constraint and return the existing session or reject the duplicate

### Requirement: Tile events table
The system SHALL store granular tile-level events in a `tile_events` table for engagement analytics, including tile clears, line wins, and keyword earnings.

#### Scenario: Tile clear event stored
- **GIVEN** a player clears a tile
- **WHEN** the event recording endpoint is called with eventType "cleared"
- **THEN** the system MUST insert a tile_events record with the game_session_id, tile_index, event_type, and created_at timestamp

#### Scenario: Line win event with keyword
- **GIVEN** a player wins a bingo line
- **WHEN** the event recording endpoint is called with eventType "line_won"
- **THEN** the system MUST insert a tile_events record including the keyword and line_id

### Requirement: Submissions table
The system SHALL store keyword submissions in a `submissions` table with a unique constraint on (player_id, keyword) to prevent duplicate submissions by the same player.

#### Scenario: Unique submission accepted
- **GIVEN** a player has not previously submitted this keyword
- **WHEN** the submission is inserted
- **THEN** the system MUST store the record with player_id, org_id, keyword, campaign_id, and created_at

#### Scenario: Duplicate submission rejected by constraint
- **GIVEN** a submission already exists with the same player_id and keyword
- **WHEN** a duplicate insert is attempted
- **THEN** the database MUST reject the insert via the unique constraint

### Requirement: Leaderboard aggregation query
The system SHALL support an aggregation query that computes per-organization scores as COUNT(DISTINCT keyword), contributor counts as COUNT(DISTINCT email), and last submission timestamp, filtered by campaign_id.

#### Scenario: Leaderboard query returns ranked results
- **GIVEN** multiple submissions exist across organizations for campaign "APR26"
- **WHEN** the leaderboard aggregation query is executed
- **THEN** the system MUST return organizations ranked by distinct keyword count descending, with contributor count and last submission time

### Requirement: Migration scripts in database folder
The system SHALL provide numbered SQL migration scripts in the `database/` folder for creating tables and seeding initial data.

#### Scenario: Tables created from migration script
- **GIVEN** a fresh Azure SQL database
- **WHEN** `001-create-tables.sql` is executed
- **THEN** all tables (organizations, org_domains, players, game_sessions, tile_events, submissions) MUST be created with correct columns, constraints, and indexes

#### Scenario: Organizations seeded from seed script
- **GIVEN** tables have been created
- **WHEN** `002-seed-organizations.sql` is executed
- **THEN** all organizations and domain mappings from the existing orgMap.js MUST be present in the database

### Requirement: Index for leaderboard performance
The system SHALL include a composite index on submissions(campaign_id, org_id) to support efficient leaderboard aggregation queries.

#### Scenario: Leaderboard query uses index
- **GIVEN** the submissions table has the composite index
- **WHEN** the leaderboard aggregation query filters by campaign_id and groups by org_id
- **THEN** the query MUST be able to leverage the index for efficient execution

### Requirement: Admin OTPs table
The system SHALL store admin OTP codes in an `admin_otps` table with hashed codes, expiry timestamps, and usage tracking.

#### Scenario: OTP record created
- **GIVEN** an admin requests an OTP
- **WHEN** the OTP is generated
- **THEN** the system MUST insert a record with the email, SHA-256 hashed code, expires_at (10 minutes from now), and used flag set to 0

#### Scenario: OTP marked as used
- **GIVEN** an admin successfully verifies an OTP
- **WHEN** the verification succeeds
- **THEN** the system MUST set the OTP's `used` flag to 1 to prevent reuse

### Requirement: Campaigns table
The system SHALL store campaign configuration in a `campaigns` table with settings for pack count, week count, and Copilot URL.

#### Scenario: Campaign record structure
- **GIVEN** the database is initialized with the migration
- **WHEN** a query fetches a campaign
- **THEN** the record MUST contain id (NVARCHAR(20) PK), display_name, total_packs (INT), total_weeks (INT), copilot_url (NVARCHAR(500)), is_active (BIT), and created_at

#### Scenario: Default campaign seeded
- **GIVEN** the migration runs for the first time
- **WHEN** the campaigns table is created
- **THEN** the system MUST insert a seed record with id='APR26', display_name='April 2026', total_packs=999, total_weeks=7, copilot_url='https://m365.cloud.microsoft/chat', is_active=1
