## ADDED Requirements

### Requirement: Admin OTP ACS delivery depends on resolved runtime configuration
The system SHALL send admin OTP email through Azure Communication Services only when the ACS connection string and sender settings are resolved runtime values, and SHALL fail visibly when those settings are missing or unresolved in production.

#### Scenario: Admin OTP sends with resolved ACS settings
- **GIVEN** an email is in the effective admin allow-list and `ACS_CONNECTION_STRING` plus `ACS_EMAIL_SENDER` are resolved runtime values
- **WHEN** `POST /api/portal-api/request-otp` is called with that email
- **THEN** the system MUST send the OTP through Azure Communication Services Email, store only the OTP hash, and emit `admin_otp_send_attempt` with `outcome: "sent"` when ACS reports success

#### Scenario: Admin OTP rejects unresolved Key Vault reference
- **GIVEN** an email is in the effective admin allow-list and `ACS_CONNECTION_STRING` or `ACS_EMAIL_SENDER` is visible to the application as an unresolved `@Microsoft.KeyVault(...)` reference
- **WHEN** `POST /api/portal-api/request-otp` is called with that email
- **THEN** the system MUST invalidate any inserted OTP, return HTTP 502 or 503 with the existing generic delivery-failure message, and emit `admin_otp_send_attempt` with `outcome: "acs_failed"` and `acs_send_status: "not_configured"`

#### Scenario: Deployed admin OTP smoke test uses ACS
- **GIVEN** the Function App has just been deployed or its Key Vault networking has changed
- **WHEN** an operator runs the documented admin OTP smoke test against an allow-listed test admin email
- **THEN** the test MUST exercise Azure Communication Services Email rather than a development skip path and MUST confirm that an OTP email is delivered or that a provider/configuration failure is reported with non-sensitive telemetry