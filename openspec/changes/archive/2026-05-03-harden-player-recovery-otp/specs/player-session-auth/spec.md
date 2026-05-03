## ADDED Requirements

### Requirement: Player recovery verification errors are user-actionable
The system SHALL present player recovery verification failures according to their failure class so players can distinguish an invalid or expired code from a temporary service failure.

#### Scenario: Invalid recovery code shows invalid-or-expired message
- **GIVEN** the player recovery UI has submitted a recovery code
- **WHEN** `POST /api/player/recovery/verify` returns HTTP 401 with `{ ok: false, message: "Invalid or expired code" }`
- **THEN** the frontend MUST show the invalid-or-expired recovery-code message and MUST NOT show a service-failure retry message

#### Scenario: Recovery verification service failure shows retry message
- **GIVEN** the player recovery UI has submitted a recovery code
- **WHEN** `POST /api/player/recovery/verify` returns HTTP 5xx, status `0`, or a response without a readable JSON message
- **THEN** the frontend MUST show a retry-later service-failure message and MUST NOT describe the code as invalid or expired

## MODIFIED Requirements

### Requirement: Player recovery challenge issuance
The system SHALL allow a player who lacks a matching token to request a short-lived recovery code for their player email without granting admin access or revealing whether the email is registered.

#### Scenario: Existing player requests recovery code
- **GIVEN** a player record exists for the supplied email and the player has a claimed token
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST store a hashed, expiring recovery code, MUST send a recovery email containing the plaintext code in branded HTML content and plain-text fallback content, MUST return a neutral success response, and MUST NOT include the code in the response body

#### Scenario: Unknown email receives neutral response
- **GIVEN** no player record exists for the supplied email
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST return the same neutral success response shape used for existing players and MUST NOT send a recovery code

#### Scenario: Recovery request is rate limited
- **GIVEN** a recent recovery code was requested for the supplied email within the configured cooldown window
- **WHEN** `POST /api/player/recovery/request` is called again
- **THEN** the system MUST return HTTP 429 with `{ ok: false, message: "Please wait before requesting another code" }` and MUST NOT create another usable code

### Requirement: Player recovery ACS delivery depends on resolved runtime configuration
The system SHALL send player recovery codes through Azure Communication Services only when the ACS connection string and sender settings are resolved runtime values, SHALL use branded HTML plus plain-text fallback email content, and SHALL fail visibly when those settings are missing or unresolved in production.

#### Scenario: Player recovery sends with resolved ACS settings
- **GIVEN** a player record exists for the supplied email, the player has a claimed token, and `ACS_CONNECTION_STRING` plus `ACS_EMAIL_SENDER` are resolved runtime values
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST store only a hashed recovery code, send the plaintext code through Azure Communication Services Email, return the neutral success response, and emit `player_recovery_request` with `outcome: "sent"` when ACS reports success

#### Scenario: Player recovery email includes branded HTML and plain text
- **GIVEN** a player recovery email is rendered for delivery through Azure Communication Services Email
- **WHEN** the ACS Email payload is constructed
- **THEN** the payload MUST include `content.html` containing the same branded verification-code layout used by admin OTP with player-recovery-specific copy, MUST include `content.plainText` containing the same 6-digit code and 10-minute expiry information, and MUST preserve the existing recipient address

#### Scenario: Player recovery email preserves security-sensitive behavior
- **GIVEN** a player recovery email is rendered for delivery
- **WHEN** the email body is constructed
- **THEN** the rendered content MUST NOT include provider secrets, connection strings, raw telemetry fields, JWTs, recovery code hashes, player token values, player token hashes, or unrelated dynamic values that are not required for the recipient to complete the recovery challenge

#### Scenario: Player recovery rejects unresolved Key Vault reference
- **GIVEN** a player record exists for the supplied email, the player has a claimed token, and `ACS_CONNECTION_STRING` or `ACS_EMAIL_SENDER` is visible to the application as an unresolved `@Microsoft.KeyVault(...)` reference
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST invalidate any inserted recovery code, return HTTP 502 or 503 with the existing generic recovery delivery-failure message, and emit `player_recovery_request` with `outcome: "email_failed"` and `acs_send_status: "not_configured"`

#### Scenario: Deployed player recovery smoke test uses ACS
- **GIVEN** the Function App has just been deployed or its Key Vault networking has changed
- **WHEN** an operator runs the documented player recovery smoke test against a test player that has a claimed token
- **THEN** the test MUST exercise Azure Communication Services Email rather than a development skip path and MUST confirm that a recovery email is delivered or that a provider/configuration failure is reported with non-sensitive telemetry

### Requirement: Player recovery verification issues device token
The system SHALL verify a valid player recovery code atomically and issue a new player token bound to the existing player as an active device token.

#### Scenario: Valid recovery code creates device token
- **GIVEN** a non-expired, unused recovery code exists for the supplied player email
- **WHEN** `POST /api/player/recovery/verify` is called with the matching code
- **THEN** the system MUST atomically commit both marking the recovery code as used and persisting only the SHA-256 hash of a new opaque player token as an active device-token record for the player, MUST set the `player_token` cookie, and MUST return the raw `playerToken` in the response body

#### Scenario: Invalid recovery code is rejected
- **GIVEN** no unused, non-expired recovery code matches the supplied email and code
- **WHEN** `POST /api/player/recovery/verify` is called
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Invalid or expired code" }` and MUST NOT issue a player token

#### Scenario: Recovery code cannot be redeemed twice
- **GIVEN** two parallel verify requests submit the same valid recovery code
- **WHEN** both requests attempt to consume the code
- **THEN** at most one request MUST issue a player token, and the other request MUST return HTTP 401 without creating a device-token record

#### Scenario: Token issuance failure does not consume recovery code
- **GIVEN** a non-expired, unused recovery code exists for the supplied player email
- **WHEN** `POST /api/player/recovery/verify` finds the matching code but fails before the replacement device-token hash is committed
- **THEN** the system MUST leave the recovery code unused, MUST NOT create a partial active device-token record, MUST return a retry-later service failure, and MUST allow the same code to be retried while it remains within its expiry window

#### Scenario: Player recovery does not grant admin access
- **GIVEN** a recovery code is successfully verified for a player email that is also an admin email
- **WHEN** the player recovery response is returned
- **THEN** the response MUST NOT set admin cookies and MUST NOT return admin tokens or admin authorization state
