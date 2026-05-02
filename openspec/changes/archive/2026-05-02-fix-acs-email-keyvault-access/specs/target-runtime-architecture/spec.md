## ADDED Requirements

### Requirement: Function App Key Vault references resolve in shared environments
The system SHALL configure shared Azure Function App environments so every Key Vault-backed app setting resolves before runtime code reads it, including a declared network path when Key Vault public network access is disabled.

#### Scenario: Key Vault public access remains enabled
- **GIVEN** the Terraform deployment intentionally leaves Key Vault public network access enabled for an environment
- **WHEN** the Function App app settings are inspected after deployment
- **THEN** every Key Vault-backed setting used by runtime code MUST report a resolved status and MUST NOT be exposed as a literal `@Microsoft.KeyVault(...)` value to the application process

#### Scenario: Key Vault public access is disabled
- **GIVEN** the Terraform deployment disables Key Vault public network access for a shared environment
- **WHEN** the Function App needs to resolve Key Vault-backed app settings
- **THEN** Terraform MUST declare a private endpoint, private DNS zone or zone link for `privatelink.vaultcore.azure.net`, Function App network routing, and Key Vault access permissions sufficient for the configured Key Vault reference identity to read secrets

#### Scenario: Key Vault reference status is verified
- **GIVEN** infrastructure has been deployed or changed
- **WHEN** the operator runs the documented verification command for Function App Key Vault references
- **THEN** `ACS_CONNECTION_STRING`, `ADMIN_KEY`, `JWT_SECRET`, and `REDIS_CONNECTION_STRING` MUST report a resolved status before the deployment is considered ready for application smoke tests

### Requirement: Shared Azure environments use production runtime mode
The system SHALL configure shared Azure Function App environments with explicit production runtime mode so missing provider settings fail visibly instead of using local-development behavior.

#### Scenario: Function App receives production runtime setting
- **GIVEN** the Terraform deployment path is used for dev, staging, or production
- **WHEN** the resulting Function App app settings are inspected
- **THEN** the map MUST include `NODE_ENV = "production"`

#### Scenario: Local development can still test with ACS
- **GIVEN** a developer runs the backend locally with real `ACS_CONNECTION_STRING` and `ACS_EMAIL_SENDER` values
- **WHEN** an admin OTP or player recovery request reaches the email helper
- **THEN** the helper MUST use Azure Communication Services Email rather than the local development skip path

### Requirement: Unresolved secret references are treated as configuration failures
The system SHALL detect unresolved App Service Key Vault reference expressions before provider SDK construction and classify them as configuration failures without logging secret values or OTP codes.

#### Scenario: ACS connection string is an unresolved Key Vault reference
- **GIVEN** `ACS_CONNECTION_STRING` is visible to the application process as a literal value beginning with `@Microsoft.KeyVault(`
- **WHEN** the shared email helper prepares to send an email
- **THEN** it MUST return a structured configuration failure result without constructing the ACS Email client and without logging an OTP, recovery code, access key, or full connection string

#### Scenario: ACS sender is an unresolved Key Vault reference
- **GIVEN** `ACS_EMAIL_SENDER` is visible to the application process as a literal value beginning with `@Microsoft.KeyVault(`
- **WHEN** the shared email helper prepares to send an email
- **THEN** it MUST return a structured configuration failure result without sending email and without logging an OTP, recovery code, access key, or full sender configuration