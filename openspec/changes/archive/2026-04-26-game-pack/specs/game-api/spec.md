## MODIFIED Requirements

### Requirement: Session creation endpoint
The system SHALL expose `POST /api/sessions` to create or resume a player record and associated game session when a player starts a board, accepting email as the primary identity and enforcing server-authoritative pack assignment for the active campaign.

#### Scenario: New player starts a board
- **GIVEN** a player with a new email starts a board
- **WHEN** the frontend sends `POST /api/sessions` with identity payload
- **THEN** the system MUST create a player record keyed by email, create or resolve an active pack assignment, create a game session for that assigned pack, and return `{ ok: true, gameSessionId: <id>, packId: <assignedPackId> }`

#### Scenario: Existing player resumes incomplete assignment
- **GIVEN** a player whose email already exists and whose active assignment is incomplete
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST reuse the existing player record, preserve canonical onboarding name, and return the same assigned pack id

#### Scenario: Existing player after completed cycle
- **GIVEN** a player whose active assignment is complete at 7 of 7 weeks
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST complete the previous assignment lifecycle and return a newly assigned active pack for the next cycle

#### Scenario: Missing required fields
- **GIVEN** a request missing required identity fields
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return `{ ok: false, message: "..." }` with HTTP 400

### Requirement: Player state retrieval endpoint
The system SHALL expose `GET /api/player/state` to retrieve a player's game state by email for cross-device progress sync, without authentication, and include pack assignment lifecycle information.

#### Scenario: Player with existing sessions
- **GIVEN** a player with the given email has game sessions in the database
- **WHEN** `GET /api/player/state?email=alice@nus.edu.sg` is called
- **THEN** the system MUST return the player's active assignment and most recent active session including packId, board_state (cleared tiles, won lines, keywords, challenge profile), session counters, and session ID

#### Scenario: Player with no sessions
- **GIVEN** no player record exists for the given email
- **WHEN** `GET /api/player/state?email=unknown@example.com` is called
- **THEN** the system MUST return `{ ok: true, player: null }` indicating no existing state

#### Scenario: Completed assignment rotates on state bootstrap
- **GIVEN** the player's current assignment is complete
- **WHEN** `GET /api/player/state` is called
- **THEN** the system MUST mark the old assignment completed and return a newly active assignment for the next cycle

#### Scenario: Missing email parameter
- **GIVEN** no email query parameter is provided
- **WHEN** `GET /api/player/state` is called
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "Email is required" }`
