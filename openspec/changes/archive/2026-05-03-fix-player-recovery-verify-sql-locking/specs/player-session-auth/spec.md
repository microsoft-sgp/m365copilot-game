## MODIFIED Requirements

### Requirement: Player recovery verification issues device token

The system SHALL verify a valid player recovery code using Azure SQL-compatible transaction semantics and issue a new player token bound to the existing player as an active device token.

#### Scenario: Valid recovery code creates device token

- **GIVEN** a non-expired, unused recovery code exists for the supplied player email
- **WHEN** `POST /api/player/recovery/verify` is called with the matching code
- **THEN** the system MUST atomically commit both marking the recovery code as used and persisting only the SHA-256 hash of a new opaque player token as an active device-token record for the player, MUST set the `player_token` cookie, and MUST return the raw `playerToken` in the response body

#### Scenario: Verification locking is accepted by Azure SQL

- **GIVEN** a non-expired, unused recovery code exists for the supplied player email in Azure SQL
- **WHEN** `POST /api/player/recovery/verify` looks up and locks the matching recovery-code row
- **THEN** the database operation MUST use transaction isolation and lock hints that Azure SQL accepts, MUST NOT fail with SQL lock-hint compatibility errors, and MUST continue the normal valid-code redemption path

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