## MODIFIED Requirements

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

## ADDED Requirements

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
