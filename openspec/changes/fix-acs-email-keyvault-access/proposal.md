## Why

Admin OTP and player recovery email delivery both depend on the shared ACS Email helper, but the deployed Function App currently receives an unresolved Key Vault reference for `ACS_CONNECTION_STRING` instead of the actual connection string. This causes ACS Email sends to fail for both flows and also exposes a broader runtime-secret resolution gap for Key Vault-backed Function App settings.

## What Changes

- Restore reliable ACS Email delivery for admin OTP and player recovery by ensuring Function App Key Vault references resolve before runtime code reads them.
- Declare a repeatable Key Vault access/networking model in Terraform so disabling public Key Vault access does not break Function App settings.
- Pin production runtime behavior explicitly so missing ACS configuration cannot silently take a local-development skip path in shared Azure environments.
- Add deployment verification that proves Key Vault references resolve and both email flows can send through Azure Communication Services in the target environment.
- Update operator documentation with a safe local ACS email test path, runtime diagnostics, rollback guidance, and the known failure signatures.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `target-runtime-architecture`: Require secure, repeatable resolution of Key Vault-backed Function App settings, including the network path when Key Vault public access is disabled, and require shared Azure environments to run with production runtime mode.
- `admin-auth`: Strengthen the admin OTP delivery contract so deployed verification covers successful ACS Email delivery and unresolved Key Vault references are treated as provider/configuration failures rather than successful sends.
- `player-session-auth`: Strengthen the player recovery challenge contract so deployed verification covers successful ACS Email delivery using the same resolved ACS configuration as admin OTP.

## Impact

- Affected teams: app maintainers, event operators, and infrastructure/deployment owners.
- Affected infrastructure: `infra/terraform/` Key Vault, Function App app settings, Key Vault access policy or private endpoint/private DNS resources, and production runtime settings.
- Affected backend: shared email helper behavior and observability around ACS configuration failures, plus admin OTP and player recovery request verification.
- Affected docs: deployment, Terraform, and support runbooks for ACS Email, Key Vault reference diagnostics, local ACS testing, and rollback.
- Rollback plan: temporarily re-enable Key Vault public network access or set the ACS settings directly on the Function App using approved secret-handling procedures, restart the Function App, and request fresh OTP/recovery codes while the durable private Key Vault path is corrected.