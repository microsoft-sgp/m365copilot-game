## MODIFIED Requirements

### Requirement: Token enforcement feature flag

The system SHALL respect an `ENABLE_PLAYER_TOKEN_ENFORCEMENT` environment variable that gates whether enforcement runs on protected endpoints, while issuance SHALL always run regardless of the flag, AND the deployment infrastructure SHALL pin this flag to `"true"` for every shared environment so the in-code default is no longer the only safeguard.

#### Scenario: Flag set to "false" disables enforcement

- **GIVEN** `ENABLE_PLAYER_TOKEN_ENFORCEMENT=false`
- **WHEN** any protected endpoint receives a request without a valid token
- **THEN** the system MUST proceed with legacy behavior (no 401), and `POST /api/sessions` MUST still issue a token

#### Scenario: Flag set to "true" or unset enforces tokens

- **GIVEN** `ENABLE_PLAYER_TOKEN_ENFORCEMENT` is unset or any value other than `"false"`
- **WHEN** any protected endpoint receives a request without a valid token
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

#### Scenario: Deployment configuration pins enforcement on

- **GIVEN** any environment provisioned via [infra/terraform/](infra/terraform/)
- **WHEN** the deployed Function App's `app_settings` are inspected
- **THEN** `ENABLE_PLAYER_TOKEN_ENFORCEMENT` MUST be set explicitly to the string `"true"` rather than relying on the in-code default of "anything other than `'false'` enables enforcement"
