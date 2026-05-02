## MODIFIED Requirements

### Requirement: Cross-device state retrieval

The system SHALL retrieve a player's existing game state from the server when an email is entered, enabling progress to persist across devices. Player email MUST be carried in the request body, never in the URL path or query string, so that addresses are not written to access logs or request-URL telemetry.

#### Scenario: Player with existing server-side progress

- **GIVEN** the player enters an email that has existing game sessions on the server
- **WHEN** the email gate is submitted
- **THEN** the system MUST call `POST /api/player/state` with `{ email }` in the JSON body, receive the player's active session data (packId, cleared tiles, won lines, keywords, challenge profile), and hydrate the Vue reactive state from the server response

#### Scenario: Player with no server-side progress

- **GIVEN** the player enters an email with no existing server records
- **WHEN** the email gate is submitted
- **THEN** the system MUST proceed to the setup panel (pack selection) with a fresh state

#### Scenario: Server unavailable during state retrieval

- **GIVEN** the API is unreachable when the player submits their email
- **WHEN** the state retrieval request fails
- **THEN** the system MUST proceed using localStorage state (if any) or fresh state, and display a subtle indicator that offline mode is active

#### Scenario: Email never appears in request URL

- **GIVEN** any client-side call to retrieve player state
- **WHEN** the request is constructed and dispatched
- **THEN** the request URL MUST be exactly `/api/player/state` with no query string carrying the email and no path segment containing the email
