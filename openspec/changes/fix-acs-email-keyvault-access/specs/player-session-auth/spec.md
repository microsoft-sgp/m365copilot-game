## ADDED Requirements

### Requirement: Player recovery ACS delivery depends on resolved runtime configuration
The system SHALL send player recovery codes through Azure Communication Services only when the ACS connection string and sender settings are resolved runtime values, and SHALL fail visibly when those settings are missing or unresolved in production.

#### Scenario: Player recovery sends with resolved ACS settings
- **GIVEN** a player record exists for the supplied email, the player has a claimed token, and `ACS_CONNECTION_STRING` plus `ACS_EMAIL_SENDER` are resolved runtime values
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST store only a hashed recovery code, send the plaintext code through Azure Communication Services Email, return the neutral success response, and emit `player_recovery_request` with `outcome: "sent"` when ACS reports success

#### Scenario: Player recovery rejects unresolved Key Vault reference
- **GIVEN** a player record exists for the supplied email, the player has a claimed token, and `ACS_CONNECTION_STRING` or `ACS_EMAIL_SENDER` is visible to the application as an unresolved `@Microsoft.KeyVault(...)` reference
- **WHEN** `POST /api/player/recovery/request` is called with that email
- **THEN** the system MUST invalidate any inserted recovery code, return HTTP 502 or 503 with the existing generic recovery delivery-failure message, and emit `player_recovery_request` with `outcome: "email_failed"` and `acs_send_status: "not_configured"`

#### Scenario: Deployed player recovery smoke test uses ACS
- **GIVEN** the Function App has just been deployed or its Key Vault networking has changed
- **WHEN** an operator runs the documented player recovery smoke test against a test player that has a claimed token
- **THEN** the test MUST exercise Azure Communication Services Email rather than a development skip path and MUST confirm that a recovery email is delivered or that a provider/configuration failure is reported with non-sensitive telemetry