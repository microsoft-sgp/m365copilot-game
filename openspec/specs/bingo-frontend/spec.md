# bingo-frontend

## Purpose

Defines the user-facing Bingo game frontend: how the application is structured, how boards are generated and progressed, how state and submissions persist in the browser, and how the experience is styled.

## Requirements

### Requirement: Dedicated Vue frontend application
The system SHALL provide the Bingo game through a dedicated frontend application located in `frontend/`, with the game experience rendered by Vue components instead of a single static HTML file with imperative DOM updates.

#### Scenario: Frontend application loads the game shell
- **GIVEN** a user opens the migrated frontend entry point
- **WHEN** the application initializes successfully
- **THEN** the user MUST see the game shell with the Game Board, My Keywords, Submit and Leaderboard, and Help sections available from the interface

### Requirement: Deterministic board setup and generation
The system SHALL allow a player to start a board by entering a name and choosing a pack number from 1 through 999 or by using a quick-pick action, and the same pack number MUST generate the same task set and order as the current implementation.

#### Scenario: Player starts a board with a valid pack number
- **GIVEN** the player has entered a non-empty name and selected a valid pack number
- **WHEN** the player starts the board
- **THEN** the system MUST create a 3x3 board with nine tasks derived deterministically from that pack number

#### Scenario: Player uses quick pick
- **GIVEN** the player is on the setup view without an active board
- **WHEN** the player uses the quick-pick action
- **THEN** the system MUST select a pack number within the supported range and make it available for board launch

### Requirement: Board progression and verification parity
The system SHALL preserve the current board progression rules, including task prompt display, proof submission, verification feedback, tile clearing, line completion detection, keyword minting, and weekly challenge progression.

#### Scenario: Proof passes verification for a tile
- **GIVEN** a player has opened a tile and submitted proof that satisfies that tile's verification rules
- **WHEN** the player confirms verification
- **THEN** the system MUST mark the tile as cleared, persist the updated board state, and update progress indicators in the interface

#### Scenario: Player completes a Bingo line
- **GIVEN** a player clears the last remaining tile for a row, column, or diagonal that has not yet been awarded
- **WHEN** the board state is re-evaluated
- **THEN** the system MUST award the corresponding keyword once, record the completed line, and present the win feedback to the player

### Requirement: Browser persistence and session continuity
The system SHALL preserve game state in browser storage for offline resilience and additionally report game session starts and tile events to the server for engagement analytics.

#### Scenario: Player starts a board and session is reported
- **GIVEN** a player enters a name and selects a pack to start a board
- **WHEN** the board is created
- **THEN** the system MUST persist state to localStorage AND send a fire-and-forget `POST /api/sessions` to register the session server-side

#### Scenario: Player clears a tile and event is reported
- **GIVEN** a player has an active board with a known gameSessionId
- **WHEN** a tile is verified and cleared
- **THEN** the system MUST update localStorage AND send a fire-and-forget `POST /api/events` to record the tile event server-side

#### Scenario: API failure does not block gameplay
- **GIVEN** the backend API is temporarily unavailable
- **WHEN** a session creation or event recording call fails
- **THEN** the game MUST continue normally using localStorage state without displaying errors to the player

#### Scenario: Player reloads with an active board
- **GIVEN** a player has an active board and saved local data in the browser
- **WHEN** the player reloads the page
- **THEN** the system MUST restore the active board, cleared tiles, earned keywords, and related progress from browser storage

### Requirement: Tailwind CSS is the primary styling entry
The system SHALL style the migrated frontend through Tailwind CSS, with `tailwind.css` serving as the primary global stylesheet entry for shared theme tokens, reusable visual effects, and responsive presentation.

#### Scenario: Tailwind styling is applied to the migrated experience
- **GIVEN** the migrated frontend is loaded in a supported browser
- **WHEN** the interface renders the game shell and its primary interactive views
- **THEN** the experience MUST render with Tailwind-driven styling rather than depending on the legacy inline stylesheet from the single-file implementation

#### Scenario: Responsive layout remains usable on smaller screens
- **GIVEN** a player views the migrated frontend on a narrow viewport
- **WHEN** the setup form, board, or modal views are displayed
- **THEN** the layout MUST remain readable and operable without horizontal overflow caused by the migration

### Requirement: Submission and leaderboard behavior is preserved
The system SHALL persist keyword submissions to the server via `POST /api/submissions` and retrieve the shared leaderboard from `GET /api/leaderboard`, while retaining localStorage as an offline fallback cache.

#### Scenario: Submission with a valid keyword is accepted
- **GIVEN** the player provides organization, name, email, and a keyword that matches the accepted format
- **WHEN** the player submits the keyword
- **THEN** the system MUST send the submission to `POST /api/submissions`, store it locally in localStorage as a cache, and update the leaderboard from the server response

#### Scenario: Submission when API is unavailable
- **GIVEN** the player provides valid submission data but the API is unreachable
- **WHEN** the player submits the keyword
- **THEN** the system MUST store the submission in localStorage and display a message indicating the submission was saved locally but not yet synced to the server

#### Scenario: Duplicate keyword submission is handled consistently
- **GIVEN** a submission already exists for the same email address and keyword combination
- **WHEN** the player submits that same keyword again
- **THEN** the system MUST reject the duplicate submission based on the server response (HTTP 409) and explain that it has already been submitted

### Requirement: Leaderboard polls server at regular intervals
The system SHALL poll `GET /api/leaderboard` every 30 seconds to display a shared, up-to-date leaderboard reflecting all participants' submissions.

#### Scenario: Leaderboard refreshes automatically
- **GIVEN** the leaderboard view is visible
- **WHEN** 30 seconds elapse since the last fetch
- **THEN** the system MUST fetch fresh leaderboard data from `GET /api/leaderboard` and update the displayed rankings

#### Scenario: Leaderboard refreshes after submission
- **GIVEN** a player has just submitted a keyword successfully
- **WHEN** the submission API returns success
- **THEN** the system MUST immediately fetch updated leaderboard data rather than waiting for the next polling interval

#### Scenario: Polling stops when leaderboard is not visible
- **GIVEN** the player has navigated away from the leaderboard tab
- **WHEN** the leaderboard component is unmounted or hidden
- **THEN** the system MUST stop polling to avoid unnecessary network requests

### Requirement: API client utility module
The system SHALL provide a thin fetch wrapper at `frontend/src/lib/api.js` for all backend communication, encapsulating the base URL, error handling, and JSON parsing.

#### Scenario: API call succeeds
- **GIVEN** the backend is reachable
- **WHEN** an API function is called
- **THEN** the wrapper MUST return the parsed JSON response body

#### Scenario: API call fails with network error
- **GIVEN** the backend is unreachable
- **WHEN** an API function is called
- **THEN** the wrapper MUST return a failure result without throwing an unhandled exception, allowing callers to fall back to localStorage
