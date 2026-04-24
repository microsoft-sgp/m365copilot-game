# player-identity

## Purpose

Defines the email-based player identity system including the email gate, cross-device state retrieval, and server-side board state persistence.

## Requirements

### Requirement: Email gate on first load
The system SHALL present an email input screen before the game setup panel when no player email is stored locally.

#### Scenario: New player enters email for the first time
- **GIVEN** no player email exists in localStorage
- **WHEN** the player loads the application
- **THEN** the system MUST display an email input screen with a text field and a "Continue" button, blocking access to the game until an email is provided

#### Scenario: Returning player with stored email skips gate
- **GIVEN** a valid player email exists in localStorage
- **WHEN** the player loads the application
- **THEN** the system MUST skip the email gate and proceed directly to the game (setup or active board)

#### Scenario: Email is validated before proceeding
- **GIVEN** the player is on the email gate screen
- **WHEN** the player submits an empty string or a value without an `@` character
- **THEN** the system MUST display a validation error and NOT proceed

### Requirement: Cross-device state retrieval
The system SHALL retrieve a player's existing game state from the server when an email is entered, enabling progress to persist across devices.

#### Scenario: Player with existing server-side progress
- **GIVEN** the player enters an email that has existing game sessions on the server
- **WHEN** the email gate is submitted
- **THEN** the system MUST call `GET /api/player/state?email=<email>`, receive the player's active session data (packId, cleared tiles, won lines, keywords, challenge profile), and hydrate the Vue reactive state from the server response

#### Scenario: Player with no server-side progress
- **GIVEN** the player enters an email with no existing server records
- **WHEN** the email gate is submitted
- **THEN** the system MUST proceed to the setup panel (pack selection) with a fresh state

#### Scenario: Server unavailable during state retrieval
- **GIVEN** the API is unreachable when the player submits their email
- **WHEN** the state retrieval request fails
- **THEN** the system MUST proceed using localStorage state (if any) or fresh state, and display a subtle indicator that offline mode is active

### Requirement: Email stored as identity anchor
The system SHALL persist the player's email in localStorage and include it in all subsequent API calls to maintain identity consistency.

#### Scenario: Email persisted after entry
- **GIVEN** the player enters a valid email on the email gate
- **WHEN** the player proceeds
- **THEN** the system MUST save the email to localStorage under a dedicated key and include it in the reactive game state

#### Scenario: Session creation includes email
- **GIVEN** a player with a stored email starts a new board
- **WHEN** `POST /api/sessions` is called
- **THEN** the request body MUST include the player's email alongside sessionId, playerName, and packId

### Requirement: Server-side board state persistence
The system SHALL persist the full board state to the server on every state mutation, making the database the source of truth for cross-device sync.

#### Scenario: Board state saved on tile clear
- **GIVEN** a player clears a tile on an active board with a known gameSessionId
- **WHEN** the tile is verified and cleared
- **THEN** the system MUST send the full board state (cleared array, won lines, keywords, challenge profile) to the server via the session update endpoint

#### Scenario: Board state saved on board start
- **GIVEN** a player starts a new board
- **WHEN** the session is created on the server
- **THEN** the system MUST persist the initial board state (all tiles uncleared, empty keywords, initial challenge profile) to the server
