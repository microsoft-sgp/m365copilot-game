## ADDED Requirements

### Requirement: Player token enforcement on game endpoints

The system SHALL require a valid player session token (matching the addressed player's `owner_token`) on `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, and `GET /api/player/state` whenever `ENABLE_PLAYER_TOKEN_ENFORCEMENT` is not set to `"false"`.

#### Scenario: Authorized session update

- **GIVEN** a `game_sessions` row with id `S` belonging to player `P`, and `P.owner_token` matches the SHA-256 of the request token
- **WHEN** `PATCH /api/sessions/:id` is called with `id = S`
- **THEN** the system MUST process the update and return HTTP 200

#### Scenario: Cross-player session update is rejected

- **GIVEN** a `game_sessions` row with id `S` belonging to player `P1`, and the request token's SHA-256 does not match `P1.owner_token`
- **WHEN** `PATCH /api/sessions/:id` is called with `id = S`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }` and MUST NOT modify the session

#### Scenario: Authorized event recording

- **GIVEN** a `game_sessions` row owned by player `P` with `P.owner_token` matching the request token
- **WHEN** `POST /api/events` is called with that `gameSessionId`
- **THEN** the system MUST insert the event and (for score-bearing types) the progression record

#### Scenario: Unauthenticated event recording is rejected

- **GIVEN** a request to `POST /api/events` with a fabricated `gameSessionId` and no token
- **WHEN** the request reaches the handler
- **THEN** the system MUST return HTTP 401 and MUST NOT insert any rows into `tile_events` or `progression_scores`

#### Scenario: Authorized keyword submission

- **GIVEN** a `players` row for the submitted email with `owner_token` matching the request token
- **WHEN** `POST /api/submissions` is called for that email
- **THEN** the system MUST process the submission as today

#### Scenario: Cross-player keyword submission is rejected

- **GIVEN** the submitted email maps to an existing player whose `owner_token` does not match the request token
- **WHEN** `POST /api/submissions` is called
- **THEN** the system MUST return HTTP 401 and MUST NOT insert into `submissions`

## MODIFIED Requirements

### Requirement: Session creation endpoint

The system SHALL expose `POST /api/sessions` to create or resume a player record and associated game session when a player starts a board, accepting email as the primary identity, enforcing server-authoritative pack assignment for the active campaign, AND issuing a player session token bound to the player's row.

#### Scenario: New player starts a board

- **GIVEN** a player with a new email starts a board
- **WHEN** the frontend sends `POST /api/sessions` with identity payload
- **THEN** the system MUST create a player record keyed by email with a hashed `owner_token`, create or resolve an active pack assignment, create a game session for that assigned pack, set the `player_token` cookie on the response, and return `{ ok: true, gameSessionId: <id>, packId: <assignedPackId>, playerToken: <token> }`

#### Scenario: Existing player resumes incomplete assignment

- **GIVEN** a player whose email already exists and whose active assignment is incomplete, and whose request carries the matching player token
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST reuse the existing player record, preserve canonical onboarding name, return the same assigned pack id, and MUST NOT rotate the token

#### Scenario: Existing player after completed cycle

- **GIVEN** a player whose active assignment is complete at 7 of 7 weeks, with a matching player token
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST complete the previous assignment lifecycle and return a newly assigned active pack for the next cycle

#### Scenario: Existing player without proof of ownership

- **GIVEN** a player whose email already exists with a non-null `owner_token`, and the request has no token or a non-matching token
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return HTTP 409 with `{ ok: false, message: "Identity in use" }`

#### Scenario: Legacy player without stored token

- **GIVEN** a `players` row for the submitted email exists with `owner_token IS NULL`
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST atomically populate `owner_token` with the hash of a newly generated token and return that token in the response

#### Scenario: Missing required fields

- **GIVEN** a request missing required identity fields
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return `{ ok: false, message: "..." }` with HTTP 400

### Requirement: Session progress update endpoint

The system SHALL expose `PATCH /api/sessions/:id` to update game session progress counters and full board state, AND SHALL require a player session token whose hash matches the owning player's `owner_token` whenever enforcement is enabled.

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

### Requirement: Event recording endpoint

The system SHALL expose `POST /api/events` to record granular tile events and create score-bearing progression records from verified event types, AND SHALL require a player session token matching the owning player whenever enforcement is enabled.

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

### Requirement: Legacy keyword submission uses shared organization resolution

The system SHALL use the shared organization resolver for `POST /api/submissions` so legacy keyword submissions and progression scoring attribute organizations consistently, AND SHALL require a player session token matching the player record for the submitted email whenever enforcement is enabled.

#### Scenario: Legacy submission returns resolved organization message

- **GIVEN** `org_domains` maps `contoso.com` to `Contoso`, and the request carries a token matching the player record for the submitted email
- **WHEN** `POST /api/submissions` receives email `alex@contoso.com` and a different manually typed organization
- **THEN** the submission MUST be attributed to `Contoso` and the response message MUST reference the resolved organization

#### Scenario: Legacy submission without matching token is rejected

- **GIVEN** enforcement is enabled and the submitted email maps to an existing player whose `owner_token` does not match the request token
- **WHEN** `POST /api/submissions` is called
- **THEN** the system MUST return HTTP 401 and MUST NOT insert into `submissions`

### Requirement: Player state retrieval endpoint

The system SHALL expose `GET /api/player/state` to retrieve a player's game state by email for cross-device progress sync, including pack assignment lifecycle information, AND SHALL require a player session token matching the player record for the supplied email whenever enforcement is enabled.

#### Scenario: Player with existing sessions and matching token

- **GIVEN** a player with the given email has game sessions in the database, and the request token matches the player's `owner_token`
- **WHEN** `GET /api/player/state?email=alice@nus.edu.sg` is called
- **THEN** the system MUST return the player's active assignment and most recent active session including packId, board_state (cleared tiles, won lines, keywords, challenge profile), session counters, and session ID

#### Scenario: Player with no sessions

- **GIVEN** no player record exists for the given email
- **WHEN** `GET /api/player/state?email=unknown@example.com` is called
- **THEN** the system MUST return `{ ok: true, player: null }` indicating no existing state

#### Scenario: Existing player without matching token returns null

- **GIVEN** enforcement is enabled, a player record exists for the supplied email, and the request token does not match `players.owner_token`
- **WHEN** `GET /api/player/state` is called
- **THEN** the system MUST return `{ ok: true, player: null }` (identical to the no-record branch) so the endpoint cannot be used as an existence oracle

#### Scenario: Completed assignment rotates on state bootstrap

- **GIVEN** the player's current assignment is complete and the request token matches
- **WHEN** `GET /api/player/state` is called
- **THEN** the system MUST mark the old assignment completed and return a newly active assignment for the next cycle

#### Scenario: Missing email parameter

- **GIVEN** a request omits the `email` query parameter
- **WHEN** `GET /api/player/state` is called
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "Email is required" }`
