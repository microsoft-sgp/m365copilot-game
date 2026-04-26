# game-api

## Purpose

Defines the Azure Functions RESTful API backend for the Copilot Chat Bingo game: session management, event tracking, keyword submission, leaderboard retrieval, input validation, and abuse protection.

## Requirements

### Requirement: Session creation endpoint
The system SHALL expose `POST /api/sessions` to create a player record and associated game session when a player starts a new board, accepting email as the primary identity and onboarding display name as immutable identity metadata.

#### Scenario: New player starts a board
- **GIVEN** a player with a new email starts a board
- **WHEN** the frontend sends `POST /api/sessions` with `{ sessionId, playerName, packId, email }`
- **THEN** the system MUST create a player record keyed by email, create a game session record, and return `{ ok: true, gameSessionId: <id> }`

#### Scenario: Existing player starts another board
- **GIVEN** a player whose email already exists in the players table
- **WHEN** the frontend sends `POST /api/sessions` with the same email and packId
- **THEN** the system MUST reuse the existing player record and MUST preserve the original onboarding playerName as the canonical display name

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

### Requirement: Event recording endpoint
The system SHALL expose `POST /api/events` to record granular tile events and create score-bearing progression records from verified event types.

#### Scenario: Tile clear event recorded
- **GIVEN** a valid gameSessionId exists
- **WHEN** the frontend sends `POST /api/events` with `{ gameSessionId, tileIndex, eventType: "cleared" }`
- **THEN** the system MUST insert a tile_events record and return `{ ok: true }`

#### Scenario: Line win event generates score record
- **GIVEN** a valid gameSessionId exists
- **WHEN** the frontend sends `POST /api/events` with `{ gameSessionId, tileIndex, eventType: "line_won", keyword, lineId }`
- **THEN** the system MUST insert a tile_events record and MUST persist an idempotent progression scoring record linked to the event

#### Scenario: Event with invalid gameSessionId
- **GIVEN** the gameSessionId does not exist in game_sessions
- **WHEN** the frontend sends `POST /api/events`
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "Invalid session" }`

### Requirement: Leaderboard retrieval endpoint
The system SHALL expose `GET /api/leaderboard` to return aggregated organization rankings from progression scoring records derived from verified gameplay.

#### Scenario: Leaderboard with progression scoring records
- **GIVEN** one or more progression scoring records exist for the current campaign
- **WHEN** the frontend sends `GET /api/leaderboard?campaign=APR26`
- **THEN** the system MUST return `{ leaderboard: [{ rank, org, score, contributors, lastSubmission }] }` sorted by score descending, where score and contributor metrics are computed from progression-derived scoring records

#### Scenario: Leaderboard with no progression scoring records
- **GIVEN** no progression scoring records exist for the requested campaign
- **WHEN** the frontend sends `GET /api/leaderboard?campaign=APR26`
- **THEN** the system MUST return `{ leaderboard: [] }`

### Requirement: Server-side input validation
The system SHALL validate all inputs server-side, including keyword format, email format, and required field presence, independent of any client-side validation.

#### Scenario: All fields present and valid
- **GIVEN** a submission request with all required fields in valid format
- **WHEN** the server processes the request
- **THEN** the system MUST proceed with the operation

#### Scenario: Missing required field
- **GIVEN** a request is missing one or more required fields
- **WHEN** the server processes the request
- **THEN** the system MUST return HTTP 400 with a message indicating which fields are missing

### Requirement: Parameterized SQL queries
The system SHALL use parameterized queries for all database operations to prevent SQL injection.

#### Scenario: User input in query
- **GIVEN** any endpoint receives user-provided data (email, keyword, org name)
- **WHEN** the data is used in a SQL query
- **THEN** the system MUST use parameterized inputs and MUST NOT interpolate user data into SQL strings

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
