## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Keyword submission endpoint
**Reason**: Manual player keyword submission is no longer the source of truth for leaderboard scoring.

**Migration**: Remove player-facing usage of `POST /api/submissions`, keep endpoint behind rollback controls during transition, and route scoring through progression-event pipeline.

### Requirement: Rate limiting on submission endpoints
**Reason**: Submission endpoint is deprecated from player flow and no longer governs primary scoring throughput.

**Migration**: Apply abuse controls to progression-event ingestion path and retire submission-specific rate-limit dependency after transition completes.
