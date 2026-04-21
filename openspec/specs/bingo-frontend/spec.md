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
The system SHALL preserve game state, player profile details, earned keywords, challenge progress, and locally stored submissions in browser storage so the player can resume the experience after a reload.

#### Scenario: Player reloads with an active board
- **GIVEN** a player has an active board and saved local data in the browser
- **WHEN** the player reloads the page
- **THEN** the system MUST restore the active board, cleared tiles, earned keywords, and related progress from browser storage

#### Scenario: Leaderboard data persists locally
- **GIVEN** one or more keyword submissions have been recorded locally
- **WHEN** the player navigates back to the submission and leaderboard section later
- **THEN** the system MUST render leaderboard results from the stored submission data without requiring a backend request

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
The system SHALL preserve the current submission validation flow, organization detection behavior, duplicate handling, and client-side leaderboard ranking semantics.

#### Scenario: Submission with a valid keyword is accepted
- **GIVEN** the player provides organization, name, email, and a keyword that matches the accepted format
- **WHEN** the player submits the keyword
- **THEN** the system MUST store the submission locally and update leaderboard data according to the existing duplicate-counting rules

#### Scenario: Duplicate keyword submission is handled consistently
- **GIVEN** a submission already exists for the same email address and keyword combination
- **WHEN** the player submits that same keyword again
- **THEN** the system MUST reject the duplicate submission and explain that it has already been submitted
