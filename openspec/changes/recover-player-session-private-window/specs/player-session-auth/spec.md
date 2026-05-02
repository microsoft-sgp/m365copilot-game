## MODIFIED Requirements

### Requirement: Player session token issuance

The system SHALL issue an opaque, server-generated player session token (`playerToken`) on `POST /api/sessions` and persist a SHA-256 hash of the token in the player's database record or an active player device-token record.

#### Scenario: New player receives a token

- **GIVEN** no `players` row exists for the submitted email
- **WHEN** `POST /api/sessions` succeeds
- **THEN** the response body MUST include a `playerToken` field containing a base64url-encoded value of at least 32 random bytes, the response MUST set an HttpOnly cookie named `player_token` with `SameSite=None; Secure; Path=/api`, the new `players` row MUST store the SHA-256 hash of the token in `owner_token`, and the system MUST create an active device-token record for the player

#### Scenario: Legacy player without a token claims their identity

- **GIVEN** a `players` row exists for the submitted email with `owner_token IS NULL`
- **WHEN** `POST /api/sessions` succeeds
- **THEN** the system MUST atomically populate `owner_token` for that row with the SHA-256 hash of a freshly generated token, MUST create an active device-token record for the player, and MUST return the token to the caller

#### Scenario: Existing player on the same device reuses their token

- **GIVEN** a `players` row exists with a non-null `owner_token` matching the SHA-256 of the `player_token` cookie or `X-Player-Token` header on the request
- **WHEN** `POST /api/sessions` is called again
- **THEN** the system MUST proceed normally (creating or reusing the session) and MUST NOT rotate the token

#### Scenario: Existing player on a recovered device reuses their device token

- **GIVEN** a `players` row exists and an active device-token record for that player matches the SHA-256 of the `player_token` cookie or `X-Player-Token` header on the request
- **WHEN** `POST /api/sessions` is called again
- **THEN** the system MUST proceed normally and MUST NOT invalidate other active device tokens for the player

#### Scenario: Existing player without proof of ownership receives recoverable conflict

- **GIVEN** a `players` row exists with a non-null `owner_token` and the request has no token or a non-matching token
- **WHEN** `POST /api/sessions` is called
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "PLAYER_RECOVERY_REQUIRED", message: "Identity in use" }`, MUST NOT modify the existing player record, and MUST NOT disclose player profile or board-state details

### Requirement: Player session token verification helper

The system SHALL provide a server-side helper that verifies a presented token against the stored player token hashes using a constant-time comparison and reads the token from either the `player_token` cookie or the `X-Player-Token` request header.

#### Scenario: Valid token in cookie

- **WHEN** a request carries a `player_token` cookie whose SHA-256 equals the stored `players.owner_token` or an active device-token hash for the addressed player
- **THEN** the helper MUST return ok with the resolved `players.id`

#### Scenario: Valid token in header

- **WHEN** a request omits the cookie but supplies an `X-Player-Token` header whose SHA-256 equals the stored `players.owner_token` or an active device-token hash for the addressed player
- **THEN** the helper MUST return ok with the resolved `players.id`

#### Scenario: Missing token

- **WHEN** a request has neither the cookie nor the header
- **THEN** the helper MUST return not-ok without treating the request as recovered

#### Scenario: Mismatched token

- **WHEN** a request carries a token whose SHA-256 does not equal the addressed player's `owner_token` or any active device-token hash for that player
- **THEN** the helper MUST return not-ok and MUST use a constant-time comparison to avoid timing oracles

#### Scenario: Revoked device token is rejected

- **GIVEN** a device-token record exists for the addressed player with `revoked_at` populated
- **WHEN** a request carries the raw token for that revoked record
- **THEN** the helper MUST return not-ok

## ADDED Requirements

### Requirement: Player recovery challenge issuance

The system SHALL allow a player who lacks a matching token to request a short-lived recovery code for their player email without granting admin access or revealing whether the email is registered.

#### Scenario: Existing player requests recovery code

- **GIVEN** a player record exists for the supplied email and the player has a claimed token
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST store a hashed, expiring recovery code, MUST send the plaintext code to the supplied email address, MUST return a neutral success response, and MUST NOT include the code in the response body

#### Scenario: Unknown email receives neutral response

- **GIVEN** no player record exists for the supplied email
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST return the same neutral success response shape used for existing players and MUST NOT send a recovery code

#### Scenario: Recovery request is rate limited

- **GIVEN** a recent recovery code was requested for the supplied email within the configured cooldown window
- **WHEN** `POST /api/player/recovery/request` is called again
- **THEN** the system MUST return HTTP 429 with `{ ok: false, message: "Please wait before requesting another code" }` and MUST NOT create another usable code

### Requirement: Player recovery verification issues device token

The system SHALL verify a valid player recovery code atomically and issue a new player token bound to the existing player as an active device token.

#### Scenario: Valid recovery code creates device token

- **GIVEN** a non-expired, unused recovery code exists for the supplied player email
- **WHEN** `POST /api/player/recovery/verify` is called with the matching code
- **THEN** the system MUST atomically mark the recovery code as used, MUST generate a new opaque player token, MUST persist only its SHA-256 hash as an active device-token record for the player, MUST set the `player_token` cookie, and MUST return the raw `playerToken` in the response body

#### Scenario: Invalid recovery code is rejected

- **GIVEN** no unused, non-expired recovery code matches the supplied email and code
- **WHEN** `POST /api/player/recovery/verify` is called
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Invalid or expired code" }` and MUST NOT issue a player token

#### Scenario: Recovery code cannot be redeemed twice

- **GIVEN** two parallel verify requests submit the same valid recovery code
- **WHEN** both requests attempt to consume the code
- **THEN** at most one request MUST issue a player token, and the other request MUST return HTTP 401 without creating a device-token record

#### Scenario: Player recovery does not grant admin access

- **GIVEN** a recovery code is successfully verified for a player email that is also an admin email
- **WHEN** the player recovery response is returned
- **THEN** the response MUST NOT set admin cookies and MUST NOT return admin tokens or admin authorization state
