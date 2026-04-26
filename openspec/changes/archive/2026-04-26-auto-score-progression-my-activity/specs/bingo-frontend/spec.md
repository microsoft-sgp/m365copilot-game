## MODIFIED Requirements

### Requirement: Dedicated Vue frontend application
The system SHALL provide the Bingo game through a dedicated frontend application located in `frontend/`, with the game experience rendered by Vue components instead of a single static HTML file with imperative DOM updates.

#### Scenario: Frontend application loads the game shell
- **GIVEN** a user opens the migrated frontend entry point
- **WHEN** the application initializes successfully
- **THEN** the user MUST see the game shell with Game, Keys, My Activity, and Help sections available from the interface

### Requirement: Deterministic board setup and generation
The system SHALL allow a player to start a board by choosing a pack number from 1 through 999 or by using a quick-pick action, and the same pack number MUST generate the same task set and order as the current implementation. Player display name SHALL be collected during onboarding identity and MUST NOT be re-requested in board setup.

#### Scenario: Player starts a board with a valid pack number
- **GIVEN** the player has completed onboarding identity and selected a valid pack number
- **WHEN** the player starts the board
- **THEN** the system MUST create a 3x3 board with nine tasks derived deterministically from that pack number

#### Scenario: Player uses quick pick
- **GIVEN** the player is on the setup view without an active board
- **WHEN** the player uses the quick-pick action
- **THEN** the system MUST select a pack number within the supported range and make it available for board launch

### Requirement: Browser persistence and session continuity
The system SHALL persist game state in browser storage for offline resilience, additionally report game session starts and tile events to the server, and sync full board state to the server for cross-device recovery.

#### Scenario: Player starts a board and session is reported
- **GIVEN** a player has completed onboarding identity and selects a pack to start a board
- **WHEN** the board is created
- **THEN** the system MUST persist state to localStorage AND send `POST /api/sessions` with sessionId, playerName, packId, and email to register the session server-side

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

## REMOVED Requirements

### Requirement: Submission and leaderboard behavior is preserved
**Reason**: Leaderboard scoring source is changed to verified progression; manual player submission is no longer part of primary gameplay UX.

**Migration**: Replace Submit panel with read-only My Activity panel. Route scoring writes through verified gameplay event flow and leaderboard refresh.

### Requirement: Leaderboard renders above submission form on Submit tab
**Reason**: Submit tab is removed from player-facing navigation.

**Migration**: Display leaderboard and progression records in My Activity context without manual form controls.
