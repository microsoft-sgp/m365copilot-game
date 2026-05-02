## MODIFIED Requirements

### Requirement: Session creation endpoint

The system SHALL expose `POST /api/sessions` to create or resume a player record and associated game session when a player starts a board, accepting email as the primary identity, enforcing server-authoritative pack assignment for the active campaign, issuing a player session token bound to the player's row, AND identifying recoverable player ownership conflicts with a stable response code.

#### Scenario: New player starts a board

- **GIVEN** a player with a new email starts a board
- **WHEN** the frontend sends `POST /api/sessions` with identity payload
- **THEN** the system MUST create a player record keyed by email with a hashed `owner_token`, create or resolve an active pack assignment, create a game session for that assigned pack, set the `player_token` cookie on the response, create an active device-token record, and return `{ ok: true, gameSessionId: <id>, packId: <assignedPackId>, playerToken: <token> }`

#### Scenario: Existing player resumes incomplete assignment

- **GIVEN** a player whose email already exists and whose active assignment is incomplete, and whose request carries a matching player token
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST reuse the existing player record, preserve canonical onboarding name, return the same assigned pack id, and MUST NOT rotate or revoke the token

#### Scenario: Existing player after completed cycle

- **GIVEN** a player whose active assignment is complete at 7 of 7 weeks, with a matching player token
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST complete the previous assignment lifecycle and return a newly assigned active pack for the next cycle

#### Scenario: Existing player without proof of ownership

- **GIVEN** a player whose email already exists with a non-null `owner_token`, and the request has no token or a non-matching token
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "PLAYER_RECOVERY_REQUIRED", message: "Identity in use" }` and MUST NOT return player profile, assignment, session, or board-state data

#### Scenario: Legacy player without stored token

- **GIVEN** a `players` row for the submitted email exists with `owner_token IS NULL`
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST atomically populate `owner_token` with the hash of a newly generated token, create an active device-token record, and return that token in the response

#### Scenario: Missing required fields

- **GIVEN** a request missing required identity fields
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return `{ ok: false, message: "..." }` with HTTP 400

## ADDED Requirements

### Requirement: Player recovery request endpoint

The system SHALL expose `POST /api/player/recovery/request` to request a player recovery code for an existing player email while avoiding account enumeration.

#### Scenario: Recovery request accepts valid email shape

- **GIVEN** a syntactically valid email is supplied
- **WHEN** the frontend sends `POST /api/player/recovery/request` with `{ email }`
- **THEN** the endpoint MUST return a JSON response with `ok: true` unless rate-limited or the email service fails for a known player

#### Scenario: Recovery request rejects invalid email shape

- **GIVEN** the request body omits email or supplies a value without an `@` character
- **WHEN** the frontend sends `POST /api/player/recovery/request`
- **THEN** the endpoint MUST return HTTP 400 with `{ ok: false, message: "Valid email is required" }`

#### Scenario: Recovery request does not require admin authorization

- **GIVEN** the supplied email is not in the admin allow-list
- **WHEN** the frontend sends `POST /api/player/recovery/request`
- **THEN** the endpoint MUST evaluate only player recovery eligibility and MUST NOT require admin cookies, admin OTP, or `X-Admin-Key`

### Requirement: Player recovery verification endpoint

The system SHALL expose `POST /api/player/recovery/verify` to verify a player recovery code and return a new player session token for the existing player.

#### Scenario: Successful verification response

- **GIVEN** the supplied recovery code is valid for the supplied player email
- **WHEN** the frontend sends `POST /api/player/recovery/verify` with `{ email, code }`
- **THEN** the endpoint MUST return `{ ok: true, playerToken: <token> }`, MUST set the `player_token` cookie, and MUST NOT return admin authentication state

#### Scenario: Verification rejects missing fields

- **GIVEN** the request body omits email or code
- **WHEN** the frontend sends `POST /api/player/recovery/verify`
- **THEN** the endpoint MUST return HTTP 400 with `{ ok: false, message: "Email and code are required" }`

#### Scenario: Verification rejects invalid code

- **GIVEN** the supplied code is invalid, expired, already used, or not associated with the supplied email
- **WHEN** the frontend sends `POST /api/player/recovery/verify`
- **THEN** the endpoint MUST return HTTP 401 with `{ ok: false, message: "Invalid or expired code" }`

### Requirement: Player recovery telemetry

The system SHALL log player recovery attempts with non-sensitive structured fields.

#### Scenario: Recovery request logging omits secrets

- **WHEN** a recovery request or verification attempt is processed
- **THEN** telemetry MUST include outcome and a non-reversible email hash, and MUST NOT include raw email addresses, recovery codes, raw player tokens, token hashes, or admin token values
