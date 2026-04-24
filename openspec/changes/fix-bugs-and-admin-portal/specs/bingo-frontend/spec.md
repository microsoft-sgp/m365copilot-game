## ADDED Requirements

### Requirement: Email gate before board setup
The system SHALL display an email input screen before the setup panel when no player email is stored, and an admin login button SHALL be visible on this screen.

#### Scenario: Email gate displayed on fresh load
- **GIVEN** no player email exists in localStorage
- **WHEN** the application loads
- **THEN** the system MUST show the email gate component instead of the setup panel or game board

#### Scenario: Admin login button visible on email gate
- **GIVEN** the email gate is displayed
- **WHEN** the screen renders
- **THEN** a clearly visible "Admin Login" button MUST be present that navigates to `#/admin/login`

### Requirement: Verify button debounce
The system SHALL disable the verify button in the tile modal during verification to prevent double-click submission.

#### Scenario: Button disabled during verification
- **GIVEN** the player is viewing a tile modal with proof entered
- **WHEN** the player clicks the "Verify & Claim" button
- **THEN** the button MUST be immediately disabled and show a loading state until verification completes

#### Scenario: Button re-enabled after verification
- **GIVEN** the verification process has completed (success or failure)
- **WHEN** the result is displayed
- **THEN** the button MUST be re-enabled (or the modal closes on success)

### Requirement: Consolidated multi-line win feedback
The system SHALL display a single consolidated notification when a tile completion results in multiple line wins, instead of separate notifications per line.

#### Scenario: Single tile completes multiple lines
- **GIVEN** clearing a tile completes two or more bingo lines simultaneously
- **WHEN** the verification succeeds
- **THEN** the system MUST display a single win modal or toast summarizing all lines won and all keywords earned (e.g., "2 lines completed! 2 keywords earned")

### Requirement: Leaderboard table mobile responsiveness
The system SHALL ensure the leaderboard table is usable on mobile viewports without horizontal clipping.

#### Scenario: Table scrolls horizontally on narrow viewport
- **GIVEN** the viewport width is less than the table's natural width
- **WHEN** the leaderboard table renders
- **THEN** the table container MUST have `overflow-x: auto` allowing horizontal scroll

#### Scenario: Timestamp column uses short format on mobile
- **GIVEN** the viewport width is less than 640px
- **WHEN** the "Last Submission" column renders
- **THEN** the timestamp MUST use a short date format (e.g., "23/04") instead of the full datetime string

### Requirement: Leaderboard table contrast improvement
The system SHALL use higher-contrast colors for leaderboard table text and borders on dark backgrounds.

#### Scenario: Table header text is legible
- **GIVEN** the leaderboard table renders on a glass-background card
- **WHEN** the header row is displayed
- **THEN** the header text MUST use `text-lilac` color (#c084fc) instead of `text-muted` (#c4b5fd) for improved contrast

#### Scenario: Row borders are visible
- **GIVEN** the leaderboard table renders
- **WHEN** table rows are displayed
- **THEN** row borders MUST use a border opacity of at least 0.15 instead of the current 0.08

## MODIFIED Requirements

### Requirement: Browser persistence and session continuity
The system SHALL persist game state in browser storage for offline resilience, additionally report game session starts and tile events to the server, and sync full board state to the server for cross-device recovery.

#### Scenario: Player starts a board and session is reported
- **GIVEN** a player enters a name and selects a pack to start a board
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

### Requirement: Submission and leaderboard behavior is preserved
The system SHALL persist keyword submissions to the server via `POST /api/submissions` and retrieve the shared leaderboard from `GET /api/leaderboard`, while retaining localStorage as an offline fallback cache. The admin clear-data section SHALL be removed from the submission panel.

#### Scenario: Submission with a valid keyword is accepted
- **GIVEN** the player provides organization, name, email, and a keyword that matches the accepted format
- **WHEN** the player submits the keyword
- **THEN** the system MUST send the submission to `POST /api/submissions`, store it locally in localStorage as a cache, and update the leaderboard from the server response

#### Scenario: Admin clear data section removed from SubmitPanel
- **GIVEN** the submission and leaderboard view renders
- **WHEN** a non-admin player views the page
- **THEN** the "Admin — Clear Local Data" section MUST NOT be displayed; this functionality is moved to the admin portal
