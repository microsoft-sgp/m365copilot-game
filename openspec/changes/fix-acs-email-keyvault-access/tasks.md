## 1. Infrastructure Configuration

- [x] 1.1 Decide and document the target Key Vault access model for this environment: durable private endpoint/private DNS path, temporary public-access restore, or both with clear rollout order.
- [x] 1.2 Update `infra/terraform/` so Function App Key Vault references can resolve when Key Vault public network access is disabled, including any required Key Vault private endpoint, `privatelink.vaultcore.azure.net` DNS zone/link, and dependencies.
- [x] 1.3 Ensure the Function App Key Vault reference identity has `Get`/`List` secret access for all referenced secrets after the networking model is applied.
- [x] 1.4 Add `NODE_ENV = "production"` to shared Function App app settings through Terraform.
- [x] 1.5 Add or update Terraform outputs/docs needed to inspect Key Vault reference status without printing secret values.

## 2. Email Configuration Handling

- [x] 2.1 Update `backend/src/lib/email.ts` to detect missing, blank, or unresolved `@Microsoft.KeyVault(...)` ACS settings before constructing `EmailClient`.
- [x] 2.2 Return a structured `not_configured` email result for unresolved ACS settings without logging OTP codes, recovery codes, ACS access keys, or full connection strings.
- [x] 2.3 Preserve existing admin OTP and player recovery caller behavior: failed-send row invalidation, HTTP 503 response, and non-sensitive telemetry.
- [x] 2.4 Keep local development skip behavior only for genuinely missing ACS settings in non-production mode, while allowing real local ACS tests when ACS env vars are supplied.

## 3. Tests

- [x] 3.1 Add backend unit tests for the shared email helper covering unresolved Key Vault reference values for `ACS_CONNECTION_STRING` and `ACS_EMAIL_SENDER`.
- [x] 3.2 Update admin OTP request tests to assert unresolved ACS settings produce `acs_failed` with `acs_send_status: "not_configured"` and invalidate inserted OTPs.
- [x] 3.3 Update player recovery request tests to assert unresolved ACS settings produce `email_failed` with `acs_send_status: "not_configured"` and invalidate inserted recovery codes.
- [x] 3.4 Add or update infrastructure validation checks that assert Function App Key Vault references report resolved status before smoke tests run.

## 4. Documentation and Operations

- [x] 4.1 Update deployment documentation with Key Vault reference diagnostics, safe redacted commands, and the `AccessToKeyVaultDenied` / `Invalid connection string @Microsoft.KeyVault(...)` failure signatures.
- [x] 4.2 Update Terraform documentation with the selected Key Vault networking model and rollback procedure.
- [x] 4.3 Document local ACS testing using real `ACS_CONNECTION_STRING` and `ACS_EMAIL_SENDER` values without committing `local.settings.json` or secret material.
- [x] 4.4 Update support guidance for admin OTP and player recovery so operators check Key Vault reference status before asking users to retry.

## 5. Verification

- [x] 5.1 Run backend `npm test` after email helper and endpoint test updates.
- [x] 5.2 Run backend type-check and lint for the changed backend code.
- [x] 5.3 Run Terraform validation/plan checks for the infrastructure changes without printing secret values.
- [x] 5.4 Deploy or apply the selected fix to the dev environment, restart the Function App if needed, and verify Key Vault-backed app settings resolve.
- [x] 5.5 Perform live ACS smoke checks for admin OTP and player recovery using approved test recipients, confirming actual email delivery or non-sensitive provider/configuration failure telemetry.
- [x] 5.6 Run `openspec validate fix-acs-email-keyvault-access --strict` and resolve any artifact issues.