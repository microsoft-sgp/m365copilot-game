## ADDED Requirements

### Requirement: Active assignment reroll endpoint

The system SHALL expose `POST /api/player/assignment/reroll` to replace the authenticated player's active assignment for the active campaign with a fresh active assignment and game session. The endpoint SHALL require an email identity and a player session token matching that player's `owner_token` whenever token enforcement is enabled.

#### Scenario: Existing player rerolls active assignment

- **GIVEN** a player has an active assignment and the request carries a matching player token
- **WHEN** the frontend sends `POST /api/player/assignment/reroll` with the player's identity payload
- **THEN** the system MUST mark the previous active assignment abandoned, create a replacement active assignment, create a game session for the replacement assignment, and return `{ ok: true, gameSessionId: <id>, packId: <assignedPackId>, activeAssignment: <assignment> }`

#### Scenario: Reroll does not blacklist abandoned pack

- **GIVEN** a player rerolls away from pack 42
- **WHEN** future assignments are resolved for that player
- **THEN** the API MUST NOT exclude pack 42 solely because it appears on an abandoned assignment for that player

#### Scenario: Reroll without matching token requires recovery

- **GIVEN** a player record exists for the supplied email with a non-null `owner_token`
- **AND** the request has no token or a non-matching token
- **WHEN** the frontend sends `POST /api/player/assignment/reroll`
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "PLAYER_RECOVERY_REQUIRED", message: "Identity in use" }` and MUST NOT abandon assignments or return player state

#### Scenario: Reroll with missing identity is rejected

- **GIVEN** the request body omits required identity fields
- **WHEN** the frontend sends `POST /api/player/assignment/reroll`
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "..." }`

#### Scenario: Reroll for player without active assignment creates first assignment

- **GIVEN** the authenticated player has no active assignment for the active campaign
- **WHEN** the frontend sends `POST /api/player/assignment/reroll`
- **THEN** the system MUST create and return one active assignment using the normal assignment distribution rules

## MODIFIED Requirements

### Requirement: Session progress update endpoint

The system SHALL expose `PATCH /api/sessions/:id` to update game session progress counters and full board state, AND SHALL require a player session token whose hash matches the owning player's `owner_token` whenever enforcement is enabled. When a game session is linked to an assignment lifecycle record, the endpoint SHALL only accept progress updates while that assignment is active.

#### Scenario: Progress update with board state

- **GIVEN** a game session exists with the given id, and the request carries a player token matching the owning player
- **WHEN** the frontend sends `PATCH /api/sessions/:id` with `{ tilesCleared, linesWon, keywordsEarned, boardState }`
- **THEN** the system MUST update the session's counters, store the `boardState` JSON, and set `last_active_at` to the current UTC time

#### Scenario: Progress update without a matching token

- **GIVEN** enforcement is enabled and the request token does not match the owning player's `owner_token`
- **WHEN** `PATCH /api/sessions/:id` is called
- **THEN** the system MUST return HTTP 401 and MUST NOT modify the session

#### Scenario: Progress update with nonexistent session

- **GIVEN** no game session exists with the given id
- **WHEN** the frontend sends `PATCH /api/sessions/:id`
- **THEN** the system MUST return HTTP 404 with `{ ok: false, message: "Session not found" }`

#### Scenario: Progress update for abandoned assignment session

- **GIVEN** a game session exists and is linked to an assignment whose status is `abandoned`
- **WHEN** the frontend sends `PATCH /api/sessions/:id` for that session
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "ASSIGNMENT_NOT_ACTIVE", message: "..." }` and MUST NOT modify the session

#### Scenario: Progress update for completed assignment session

- **GIVEN** a game session exists and is linked to an assignment whose status is `completed`
- **WHEN** the frontend sends `PATCH /api/sessions/:id` for that session
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "ASSIGNMENT_NOT_ACTIVE", message: "..." }` and MUST NOT modify the session

### Requirement: Event recording endpoint

The system SHALL expose `POST /api/events` to record granular tile events and create score-bearing progression records from verified event types, AND SHALL require a player session token matching the owning player whenever enforcement is enabled. When an event targets a game session linked to an assignment lifecycle record, the endpoint SHALL only accept events while that assignment is active.

#### Scenario: Tile clear event recorded

- **GIVEN** a valid gameSessionId exists owned by player `P`, and the request token matches `P.owner_token`
- **WHEN** the frontend sends `POST /api/events` with `{ gameSessionId, tileIndex, eventType: "cleared" }`
- **THEN** the system MUST insert a tile_events record and return `{ ok: true }`

#### Scenario: Line win event generates score record

- **GIVEN** a valid gameSessionId exists owned by player `P`, and the request token matches `P.owner_token`
- **WHEN** the frontend sends `POST /api/events` with `{ gameSessionId, tileIndex, eventType: "line_won", keyword, lineId }`
- **THEN** the system MUST insert a tile_events record and MUST persist an idempotent progression scoring record linked to the event

#### Scenario: Event without matching token

- **GIVEN** enforcement is enabled and the request token does not match the owning player
- **WHEN** the frontend sends `POST /api/events`
- **THEN** the system MUST return HTTP 401 and MUST NOT insert into `tile_events` or `progression_scores`

#### Scenario: Event with invalid gameSessionId

- **GIVEN** the gameSessionId does not exist in game_sessions
- **WHEN** the frontend sends `POST /api/events`
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "Invalid session" }`

#### Scenario: Event for abandoned assignment session

- **GIVEN** the gameSessionId exists and is linked to an assignment whose status is `abandoned`
- **WHEN** the frontend sends `POST /api/events` for that session
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "ASSIGNMENT_NOT_ACTIVE", message: "..." }` and MUST NOT insert into `tile_events` or `progression_scores`

#### Scenario: Event for completed assignment session

- **GIVEN** the gameSessionId exists and is linked to an assignment whose status is `completed`
- **WHEN** the frontend sends `POST /api/events` for that session
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "ASSIGNMENT_NOT_ACTIVE", message: "..." }` and MUST NOT insert into `tile_events` or `progression_scores`