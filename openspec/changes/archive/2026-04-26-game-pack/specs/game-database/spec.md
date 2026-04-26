## MODIFIED Requirements

### Requirement: Game sessions table
The system SHALL store game session records in a `game_sessions` table tracking which player started which assigned pack, with summary counters and full board state for cross-device sync.

#### Scenario: Game session created on board start
- **GIVEN** a player starts a board with an active assigned packId
- **WHEN** the session creation endpoint is called
- **THEN** the system MUST insert or reuse a game_sessions record with player_id, pack_id, campaign_id, initial counters set to zero, and board_state set to null

#### Scenario: Session progress updated with board state
- **GIVEN** a game session exists
- **WHEN** the session update endpoint is called with counter values and boardState
- **THEN** the system MUST update tiles_cleared, lines_won, keywords_earned, board_state, and set last_active_at to the current UTC time

#### Scenario: Board state stored as JSON
- **GIVEN** a game session is updated with board state
- **WHEN** the board_state column is written
- **THEN** the value MUST be a JSON string containing `{ cleared: boolean[], wonLines: string[], keywords: object[], challengeProfile: object }` stored in an NVARCHAR(MAX) column

#### Scenario: Session uniqueness aligns with active assignment lifecycle
- **GIVEN** a player has an active assignment for a campaign
- **WHEN** session creation is attempted repeatedly for that active assignment
- **THEN** the system MUST return or reuse the corresponding session and MUST NOT create conflicting active-cycle sessions

## ADDED Requirements

### Requirement: Pack assignment lifecycle persistence
The system SHALL persist pack assignment lifecycle records that identify each player-campaign cycle as active or completed and support completion-based rotation.

#### Scenario: One active assignment per player campaign
- **GIVEN** assignment lifecycle records exist for a player and campaign
- **WHEN** active records are evaluated
- **THEN** the system MUST enforce at most one active assignment for that player and campaign

#### Scenario: Completed assignment retained as history
- **GIVEN** an active assignment reaches completion
- **WHEN** the next cycle assignment is created
- **THEN** the system MUST preserve the completed assignment record for historical analysis and auditability

#### Scenario: Migration backfills active assignments
- **GIVEN** legacy databases contain players and sessions without lifecycle records
- **WHEN** the migration is applied
- **THEN** the system MUST backfill one active assignment per player-campaign from existing latest session data without losing historical sessions
