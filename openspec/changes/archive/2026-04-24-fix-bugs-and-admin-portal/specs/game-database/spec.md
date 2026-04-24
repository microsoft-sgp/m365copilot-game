## ADDED Requirements

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

## MODIFIED Requirements

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
