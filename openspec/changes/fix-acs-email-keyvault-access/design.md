## Context

Admin OTP and player recovery use separate request endpoints, but both call the same ACS Email helper in the backend. The helper expects `ACS_CONNECTION_STRING` and `ACS_EMAIL_SENDER` to be resolved Function App settings before `EmailClient` is constructed.

The deployed development Function App currently has `ACS_CONNECTION_STRING` configured as a Key Vault reference. App Service reports the reference status as `AccessToKeyVaultDenied`, and runtime telemetry shows the backend receiving the literal `@Microsoft.KeyVault(...)` value and throwing `Invalid connection string` from the ACS SDK. The Key Vault access policy includes the Function App system identity, so the immediate failure is network access: Key Vault public network access was disabled without a corresponding private endpoint/private DNS path for the Function App and operator tooling.

Current relevant flow:

```text
Admin OTP request          Player recovery request
       |                            |
       v                            v
requestOtp.ts              requestPlayerRecovery.ts
       |                            |
       +------------+---------------+
                    |
                    v
              lib/email.ts
                    |
                    v
       process.env.ACS_CONNECTION_STRING
                    |
          unresolved Key Vault ref
                    |
                    v
       ACS SDK: Invalid connection string
```

## Goals / Non-Goals

**Goals:**

- Make Terraform declare a Key Vault access/networking model that lets Function App Key Vault references resolve consistently in shared Azure environments.
- Keep ACS connection material in Key Vault, not in source control or plain deployment docs.
- Make shared Azure environments run with explicit production runtime mode so missing ACS configuration fails visibly.
- Improve configuration validation so unresolved Key Vault reference strings are treated as configuration/provider failures, not valid ACS connection strings or development skips.
- Add verification for real ACS Email delivery in local and deployed testing paths.

**Non-Goals:**

- Replace Azure Communication Services Email with another provider.
- Redesign OTP UX, code format, TTL, rate limits, or anti-enumeration behavior.
- Change the player token recovery model beyond restoring recovery email delivery.
- Rotate all production secrets unless required by follow-up operational policy.

## Decisions

### Decision 1: Keep ACS connection string in Key Vault and fix reference resolution

Terraform should continue to store `acs-connection-string` in Key Vault and expose it to the Function App through an App Service Key Vault reference. The durable fix is to make the reference resolvable instead of replacing it with a plain app setting.

Preferred private model:

```text
Function App
  | VNet integration
  v
functions subnet
  |
  | private DNS: privatelink.vaultcore.azure.net
  v
Key Vault private endpoint
  |
  v
Key Vault secrets
```

Alternatives considered:

- Re-enable Key Vault public network access. This is acceptable as a short rollback or development restore, but it weakens the private-network posture and does not codify the intended private path.
- Store the ACS connection string directly in Function App settings. This is simpler operationally but duplicates secret material outside Key Vault and should remain a temporary emergency action only.

### Decision 2: Pin shared Azure runtime mode to production

The Function App should receive `NODE_ENV = "production"` through Terraform for shared environments. The current helper intentionally skips email when ACS settings are missing outside production. That is useful locally, but dangerous in Azure because a deployment can appear successful while no email is sent.

Alternatives considered:

- Remove the development skip entirely. That would make local setup more cumbersome and break existing development behavior.
- Use a new app-specific flag. This adds configuration surface without solving the broader runtime-mode ambiguity.

### Decision 3: Treat unresolved Key Vault references as configuration failures before ACS SDK construction

The email helper should recognize values that still look like App Service Key Vault reference expressions, such as `@Microsoft.KeyVault(...)`, as unresolved configuration. In production this should return a structured `not_configured` result and preserve existing 503/failure behavior in callers; in local development with explicitly supplied ACS settings it should send through ACS normally.

Alternatives considered:

- Let the ACS SDK throw. This works but produces a generic exception and can log the unresolved reference URI in error traces.
- Add endpoint-specific checks in both request handlers. The shared helper is the root integration point, so keeping validation there avoids drift between admin OTP and player recovery.

### Decision 4: Verify ACS with a real provider path, not the dev skip path

Local and deployed verification should include a way to run against Azure Communication Services using real `ACS_CONNECTION_STRING` and `ACS_EMAIL_SENDER` values. Unit tests can keep mocking ACS, but an operator-level smoke check should prove that a real admin OTP and player recovery email can be sent in the target environment.

Alternatives considered:

- Rely only on unit tests. Unit tests prove call behavior but not App Service Key Vault resolution, ACS domain association, sender validity, or provider reachability.
- Send only admin OTP. Player recovery uses the same helper but has different request preconditions, database rows, and telemetry, so both flows need coverage.

## Risks / Trade-offs

- Key Vault private endpoint introduces DNS complexity -> Add explicit private DNS resources, link them to the app VNet, and document verification commands for `configreferences/appsettings` status.
- Terraform operators can be locked out when Key Vault public access is disabled -> Document bootstrap/rollback access paths and avoid applying private-only settings until operator access is planned.
- Real ACS smoke tests can send email to real addresses -> Require operator-provided test recipients and avoid logging codes or secret values.
- `NODE_ENV=production` changes missing-config behavior -> Validate local scripts and shared environment settings so development still has a clear ACS test path.
- Re-enabling public Key Vault access is the fastest restore but less secure -> Treat it as rollback only and track the durable private endpoint path as implementation work.

## Migration Plan

1. Update Terraform to declare the Key Vault access path selected for shared environments: preferred private endpoint plus `privatelink.vaultcore.azure.net` private DNS, or a consciously documented public-access rollback setting for dev only.
2. Add `NODE_ENV = "production"` to shared Function App app settings.
3. Update the email helper validation to classify missing or unresolved ACS settings before constructing `EmailClient`.
4. Update docs with redacted diagnostics for Key Vault references, ACS sender verification, local ACS testing, and rollback.
5. Deploy infrastructure changes, restart the Function App, and verify all Key Vault-backed app settings report `Resolved`.
6. Run live smoke checks for admin OTP and player recovery using Azure Communication Services.

Rollback:

1. Temporarily re-enable Key Vault public network access or set the ACS connection string directly as an app setting using approved secret-handling procedures.
2. Restart the Function App so App Service refreshes references and runtime environment variables.
3. Ask affected users to request fresh OTP/recovery codes because failed-send rows are invalidated.
4. Re-apply the durable private Key Vault path once DNS/networking is corrected.

## Open Questions

- Should the durable fix target private-only Key Vault access immediately, or first restore dev with public access while adding the private endpoint in the same change?
- Which mailbox should be used for repeatable ACS smoke tests in development and event environments?
- Should Terraform remove any remaining local-state workflow artifacts as part of this change, or leave that to the existing target-runtime architecture work?