## ADDED Requirements

### Requirement: Player state retrieval endpoint
The system SHALL expose `GET /api/player/state` to retrieve a player's game state by email for cross-device progress sync, without authentication.

#### Scenario: Player with existing sessions
- **GIVEN** a player with the given email has game sessions in the database
- **WHEN** `GET /api/player/state?email=alice@nus.edu.sg` is called
- **THEN** the system MUST return the player's most recent active session including packId, board_state (cleared tiles, won lines, keywords, challenge profile), session counters, and session ID

#### Scenario: Player with no sessions
- **GIVEN** no player record exists for the given email
- **WHEN** `GET /api/player/state?email=unknown@example.com` is called
- **THEN** the system MUST return `{ ok: true, player: null }` indicating no existing state

#### Scenario: Missing email parameter
- **GIVEN** no email query parameter is provided
- **WHEN** `GET /api/player/state` is called
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "Email is required" }`

### Requirement: Public organization domain map endpoint
The system SHALL expose `GET /api/organizations/domains` to return the domain-to-organization mapping from the database.

#### Scenario: Domain map returned
- **GIVEN** organizations and domain mappings exist
- **WHEN** `GET /api/organizations/domains` is called
- **THEN** the system MUST return `{ domains: { "nus.edu.sg": "NUS", ... } }`

### Requirement: Active campaign config endpoint
The system SHALL expose `GET /api/campaigns/active` to return the active campaign configuration.

#### Scenario: Active campaign returned
- **GIVEN** a campaign record with `is_active = 1` exists
- **WHEN** `GET /api/campaigns/active` is called
- **THEN** the system MUST return `{ campaignId, displayName, totalPacks, totalWeeks, copilotUrl }`

## MODIFIED Requirements

### Requirement: Session creation endpoint
The system SHALL expose `POST /api/sessions` to create a player record and associated game session when a player starts a new board, accepting email as the primary identity.

#### Scenario: New player starts a board
- **GIVEN** a player with a new email starts a board
- **WHEN** the frontend sends `POST /api/sessions` with `{ sessionId, playerName, packId, email }`
- **THEN** the system MUST create a player record keyed by email, create a game session record, and return `{ ok: true, gameSessionId: <id> }`

#### Scenario: Existing player starts another board
- **GIVEN** a player whose email already exists in the players table
- **WHEN** the frontend sends `POST /api/sessions` with the same email but a new packId
- **THEN** the system MUST reuse the existing player record, create a new game session, and return the new gameSessionId

#### Scenario: Missing required fields
- **GIVEN** a request missing sessionId, playerName, packId, or email
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return `{ ok: false, message: "..." }` with HTTP 400

### Requirement: Session progress update endpoint
The system SHALL expose `PATCH /api/sessions/:id` to update game session progress counters and full board state.

#### Scenario: Progress update with board state
- **GIVEN** a game session exists with the given id
- **WHEN** the frontend sends `PATCH /api/sessions/:id` with `{ tilesCleared, linesWon, keywordsEarned, boardState }`
- **THEN** the system MUST update the session's counters, store the `boardState` JSON, and set `last_active_at` to the current UTC time

#### Scenario: Progress update with nonexistent session
- **GIVEN** no game session exists with the given id
- **WHEN** the frontend sends `PATCH /api/sessions/:id`
- **THEN** the system MUST return HTTP 404 with `{ ok: false, message: "Session not found" }`
