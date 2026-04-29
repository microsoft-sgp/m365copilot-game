## ADDED Requirements

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
