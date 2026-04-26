## MODIFIED Requirements

### Requirement: Deterministic board setup and generation
The system SHALL allow a player to start a board using a server-assigned pack number from 1 through 999, and the same pack number MUST generate the same task set and order as the current implementation. Player display name SHALL be collected during onboarding identity and MUST NOT be re-requested in board setup.

#### Scenario: Player starts a board with assigned pack number
- **GIVEN** the player has completed onboarding identity and a valid assigned pack number exists
- **WHEN** the player starts the board
- **THEN** the system MUST create a 3x3 board with nine tasks derived deterministically from that assigned pack number

#### Scenario: Setup does not expose manual pack choice
- **GIVEN** the player is on the setup view without an active board
- **WHEN** the setup view renders
- **THEN** the system MUST display the assigned pack and MUST NOT allow manual pack entry or quick-pick selection

### Requirement: Browser persistence and session continuity
The system SHALL persist game state in browser storage for offline resilience, additionally report game session starts and tile events to the server, and sync full board state to the server for cross-device recovery.

#### Scenario: Player starts a board and session is reported
- **GIVEN** a player has completed onboarding identity and receives a server-assigned pack during startup
- **WHEN** the board is created
- **THEN** the system MUST persist state to localStorage AND send `POST /api/sessions` with sessionId, playerName, assigned packId, and email to register the session server-side

#### Scenario: Player clears a tile and event is reported
- **GIVEN** a player has an active board with a known gameSessionId
- **WHEN** a tile is verified and cleared
- **THEN** the system MUST update localStorage, send `POST /api/events` to record the tile event, AND send `PATCH /api/sessions/:id` with the full board state for cross-device sync

#### Scenario: API failure does not block gameplay
- **GIVEN** the backend API is temporarily unavailable
- **WHEN** a session creation or event recording call fails
- **THEN** the game MUST continue normally using localStorage state without displaying errors to the player

#### Scenario: Player reloads with an active board
- **GIVEN** a player has an active board and saved local data in the browser
- **WHEN** the player reloads the page
- **THEN** the system MUST restore the active board, cleared tiles, earned keywords, and related progress from browser storage
