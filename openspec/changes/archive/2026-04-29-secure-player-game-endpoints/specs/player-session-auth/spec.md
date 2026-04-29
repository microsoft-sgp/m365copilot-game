## ADDED Requirements

### Requirement: Player session token issuance

The system SHALL issue an opaque, server-generated player session token (`playerToken`) on `POST /api/sessions` and persist a SHA-256 hash of the token in the player's database record.

#### Scenario: New player receives a token

- **GIVEN** no `players` row exists for the submitted email
- **WHEN** `POST /api/sessions` succeeds
- **THEN** the response body MUST include a `playerToken` field containing a base64url-encoded value of at least 32 random bytes, the response MUST set an HttpOnly cookie named `player_token` with `SameSite=None; Secure; Path=/api`, and the new `players` row MUST store the SHA-256 hash of the token in `owner_token`

#### Scenario: Legacy player without a token claims their identity

- **GIVEN** a `players` row exists for the submitted email with `owner_token IS NULL`
- **WHEN** `POST /api/sessions` succeeds
- **THEN** the system MUST atomically populate `owner_token` for that row with the SHA-256 hash of a freshly generated token and return the token to the caller

#### Scenario: Existing player on the same device reuses their token

- **GIVEN** a `players` row exists with a non-null `owner_token` matching the SHA-256 of the `player_token` cookie or `X-Player-Token` header on the request
- **WHEN** `POST /api/sessions` is called again
- **THEN** the system MUST proceed normally (creating or reusing the session) and MUST NOT rotate the token

#### Scenario: Existing player without proof of ownership is rejected

- **GIVEN** a `players` row exists with a non-null `owner_token` and the request has no token or a non-matching token
- **WHEN** `POST /api/sessions` is called
- **THEN** the system MUST return HTTP 409 with `{ ok: false, message: "Identity in use" }` and MUST NOT modify the existing player record

### Requirement: Player session token verification helper

The system SHALL provide a server-side helper that verifies a presented token against the stored hash using a constant-time comparison and reads the token from either the `player_token` cookie or the `X-Player-Token` request header.

#### Scenario: Valid token in cookie

- **WHEN** a request carries a `player_token` cookie whose SHA-256 equals the stored `players.owner_token`
- **THEN** the helper MUST return ok with the resolved `players.id`

#### Scenario: Valid token in header

- **WHEN** a request omits the cookie but supplies an `X-Player-Token` header whose SHA-256 equals the stored `players.owner_token`
- **THEN** the helper MUST return ok with the resolved `players.id`

#### Scenario: Missing token

- **WHEN** a request has neither the cookie nor the header
- **THEN** the helper MUST return not-ok without performing a database lookup

#### Scenario: Mismatched token

- **WHEN** a request carries a token whose SHA-256 does not equal any `players.owner_token`
- **THEN** the helper MUST return not-ok and MUST use a constant-time comparison to avoid timing oracles

### Requirement: Token enforcement feature flag

The system SHALL respect an `ENABLE_PLAYER_TOKEN_ENFORCEMENT` environment variable that gates whether enforcement runs on protected endpoints, while issuance SHALL always run regardless of the flag.

#### Scenario: Flag set to "false" disables enforcement

- **GIVEN** `ENABLE_PLAYER_TOKEN_ENFORCEMENT=false`
- **WHEN** any protected endpoint receives a request without a valid token
- **THEN** the system MUST proceed with legacy behavior (no 401), and `POST /api/sessions` MUST still issue a token

#### Scenario: Flag set to "true" or unset enforces tokens

- **GIVEN** `ENABLE_PLAYER_TOKEN_ENFORCEMENT` is unset or any value other than `"false"`
- **WHEN** any protected endpoint receives a request without a valid token
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: Token never returned outside issuance

The system SHALL include the raw `playerToken` in response bodies only on `POST /api/sessions` and MUST NOT echo the token in any other endpoint response.

#### Scenario: Subsequent endpoints do not echo the token

- **GIVEN** a request to `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, or `GET /api/player/state` carrying a valid token
- **WHEN** the response is constructed
- **THEN** the response body MUST NOT contain a `playerToken` field
