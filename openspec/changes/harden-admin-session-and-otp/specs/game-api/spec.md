## MODIFIED Requirements

### Requirement: Player state retrieval endpoint

The system SHALL expose `POST /api/player/state` to retrieve a player's game state by email for cross-device progress sync, including pack assignment lifecycle information, AND SHALL require a player session token matching the player record for the supplied email whenever enforcement is enabled. The email MUST be carried in the JSON request body so it does not appear in URL access logs or request-URL telemetry.

#### Scenario: Player with existing sessions and matching token

- **GIVEN** a player with the given email has game sessions in the database, and the request token matches the player's `owner_token`
- **WHEN** `POST /api/player/state` is called with body `{ "email": "alice@nus.edu.sg" }`
- **THEN** the system MUST return the player's active assignment and most recent active session including packId, board_state (cleared tiles, won lines, keywords, challenge profile), session counters, and session ID

#### Scenario: Player with no sessions

- **GIVEN** no player record exists for the given email
- **WHEN** `POST /api/player/state` is called with body `{ "email": "unknown@example.com" }`
- **THEN** the system MUST return `{ ok: true, player: null }` indicating no existing state

#### Scenario: Existing player without matching token returns null

- **GIVEN** enforcement is enabled, a player record exists for the supplied email, and the request token does not match `players.owner_token`
- **WHEN** `POST /api/player/state` is called
- **THEN** the system MUST return `{ ok: true, player: null }` (identical to the no-record branch) so the endpoint cannot be used as an existence oracle

#### Scenario: Completed assignment rotates on state bootstrap

- **GIVEN** the player's current assignment is complete and the request token matches
- **WHEN** `POST /api/player/state` is called
- **THEN** the system MUST mark the old assignment completed and return a newly active assignment for the next cycle

#### Scenario: Missing email field

- **GIVEN** the request body lacks an `email` field, or the value is empty
- **WHEN** `POST /api/player/state` is called
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "Email is required" }`

#### Scenario: Email is not exposed in request URL

- **GIVEN** any caller of the player-state endpoint
- **WHEN** the request is dispatched
- **THEN** the request URL MUST be exactly `/api/player/state` with no email query parameter and no email path segment, so the email never enters access logs or `requests.url` telemetry

### Requirement: Player token enforcement on game endpoints

The system SHALL require a valid player session token (matching the addressed player's `owner_token`) on `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, and `POST /api/player/state` whenever `ENABLE_PLAYER_TOKEN_ENFORCEMENT` is not set to `"false"`.

#### Scenario: Authorized session update

- **GIVEN** a `game_sessions` row with id `S` belonging to player `P`, and `P.owner_token` matches the SHA-256 of the request token
- **WHEN** `PATCH /api/sessions/:id` is called with `id = S`
- **THEN** the system MUST process the update and return HTTP 200

#### Scenario: Cross-player session update is rejected

- **GIVEN** a `game_sessions` row with id `S` belonging to player `P1`, and the request token's SHA-256 does not match `P1.owner_token`
- **WHEN** `PATCH /api/sessions/:id` is called with `id = S`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }` and MUST NOT modify the session
