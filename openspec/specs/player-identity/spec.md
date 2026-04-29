# player-identity

## Purpose

Defines the email-based player identity system including the email gate, cross-device state retrieval, and server-side board state persistence.

## Requirements

### Requirement: Email gate on first load

The system SHALL present an onboarding identity screen before the game setup panel when no player identity is stored locally. The onboarding screen SHALL require email and display name, and SHALL require an organization name when the email domain is a configured public/free-mail provider that cannot identify an organization by domain.

#### Scenario: New player enters private organization email for the first time

- **GIVEN** no player identity exists in localStorage
- **WHEN** the player enters a valid non-public email and display name
- **THEN** the system MUST allow the player to continue without manually entering an organization, blocking access to the game until email and display name are provided

#### Scenario: New player enters public email for the first time

- **GIVEN** no player identity exists in localStorage
- **WHEN** the player enters a public/free-mail address such as `alex@gmail.com`
- **THEN** the system MUST require a non-empty organization name before allowing the player to continue

#### Scenario: Returning player with stored identity skips gate

- **GIVEN** a valid player email and display name exist in localStorage, and any required organization context for public/free-mail identity is stored locally
- **WHEN** the player loads the application
- **THEN** the system MUST skip the identity gate and proceed directly to the game (setup or active board)

#### Scenario: Identity fields are validated before proceeding

- **GIVEN** the player is on the onboarding identity screen
- **WHEN** the player submits an empty display name, empty email, an email without an `@` character, or a required organization name that is empty
- **THEN** the system MUST display a validation error and MUST NOT proceed

### Requirement: Organization prompt for public email users

The system SHALL conditionally show an organization input during onboarding when the entered email domain is a configured public/free-mail provider.

#### Scenario: Public email reveals organization input

- **GIVEN** the player is entering onboarding identity
- **WHEN** the email field contains `alex@outlook.com`
- **THEN** the system MUST show an organization input and MUST require it before continuing

#### Scenario: Private email hides organization input

- **GIVEN** the player is entering onboarding identity
- **WHEN** the email field contains `alex@contoso.com`
- **THEN** the system MUST not require manual organization entry because the backend can infer the organization from the email domain

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

The system SHALL persist the player's email, onboarding display name, and any required manually entered organization in localStorage and include them in subsequent session-related API calls to maintain identity and organization consistency.

#### Scenario: Identity persisted after private email entry

- **GIVEN** the player enters a valid email and non-empty display name on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the identity to localStorage under dedicated keys and include it in reactive game state

#### Scenario: Identity persisted after public email entry

- **GIVEN** the player enters a valid public/free-mail email, non-empty display name, and non-empty organization name on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the email, display name, and organization name to localStorage under dedicated keys and include them in reactive game state

#### Scenario: Session creation includes onboarding identity

- **GIVEN** a player with stored onboarding identity starts a new board
- **WHEN** `POST /api/sessions` is called
- **THEN** the request body MUST include the player's email, onboarding display name, and any stored organization name alongside sessionId and packId

### Requirement: Display name is fixed after onboarding

The system SHALL treat player display name as immutable for normal player flows after onboarding is completed.

#### Scenario: Player attempts to change display name during gameplay

- **GIVEN** a player has already completed onboarding and entered gameplay
- **WHEN** the player navigates across setup, game, keys, or activity surfaces
- **THEN** the system MUST NOT present any display name edit controls and MUST continue using the onboarding display name

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

### Requirement: Player token captured from session creation

The system SHALL capture the `playerToken` returned by `POST /api/sessions` and persist it for the duration of the browser session so subsequent game API calls can prove ownership.

#### Scenario: Token captured and stored on session create

- **GIVEN** the SPA has just received a successful `POST /api/sessions` response containing `playerToken`
- **WHEN** the response is processed
- **THEN** the SPA MUST store `playerToken` in `sessionStorage` under a dedicated key (e.g. `copilot_bingo_player_token`) and MUST NOT store it in `localStorage`

#### Scenario: Token cleared on logout / identity change

- **GIVEN** a player triggers the existing identity-clear flow (e.g. switching email)
- **WHEN** the local identity is reset
- **THEN** the SPA MUST also clear the stored `playerToken` from `sessionStorage`

### Requirement: Player token forwarded on game API calls

The system SHALL include the stored `playerToken` on every request to `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, `GET /api/player/state`, and follow-up `POST /api/sessions` calls, using the `X-Player-Token` request header in addition to the HttpOnly cookie.

#### Scenario: Token forwarded as header

- **GIVEN** the SPA has a stored `playerToken`
- **WHEN** it issues any of the listed game API calls
- **THEN** the request MUST include an `X-Player-Token` header carrying the stored token, and MUST also include `credentials: 'include'` so the HttpOnly cookie is sent when available

#### Scenario: First call without a token (cold start) still works

- **GIVEN** no `playerToken` is present in `sessionStorage` and the player has just opened the app for the first time
- **WHEN** the SPA issues `POST /api/sessions`
- **THEN** the request MUST omit the `X-Player-Token` header and the response MUST cause the SPA to capture and store the freshly-issued token before any further game API call is made

### Requirement: 401 on game endpoints triggers identity re-bootstrap

The system SHALL handle a 401 response from any game API endpoint by clearing the locally stored `playerToken` and re-running the bootstrap session-create flow before retrying the original action once.

#### Scenario: Stale token on event submission

- **GIVEN** the SPA has a stored `playerToken` that no longer matches the server's `owner_token` (e.g. after admin reset)
- **WHEN** `POST /api/events` returns HTTP 401
- **THEN** the SPA MUST clear the stored token, call `POST /api/sessions` to obtain a fresh token, and retry the original `POST /api/events` exactly once
