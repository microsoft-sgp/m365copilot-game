# Terraform Infrastructure

This folder provisions the Azure resources needed by Copilot Chat Bingo.

## What It Creates

- Resource group `rg-m365copilot-game-dev` in `koreacentral`
- Linux Azure App Service hosting the Vue frontend (built static assets)
- Linux Azure Function App on a configurable Linux App Service plan for the Node.js API
- Virtual network with separate subnets for Function App regional VNet integration and Private Endpoint resources
- Storage Account required by Azure Functions
- Azure SQL Server and `bingo_db` database (Korea Central) with public network access disabled
- SQL Private Endpoint plus `privatelink.database.windows.net` Private DNS zone linked to the VNet
- Azure Managed Redis for cache-aside API responses
- Azure Communication Services and Email Communication Service with an Azure-managed sender domain
  - Azure Communication Services resources are globally scoped by Azure. Their `data_location` defaults to `United States` for data residency and is the only non-Korea Central deployment exception.
- Key Vault for generated app secrets, with public network access disabled by default
- Key Vault Private Endpoint plus `privatelink.vaultcore.azure.net` Private DNS zone linked to the VNet so Function App Key Vault references can resolve privately
- Log Analytics workspace and Application Insights

Terraform provisions cloud resources only. Application publishing and SQL schema migrations are separate steps after `terraform apply`.

This is the recommended path for repeatable Azure deployments. The manual guide in [../../DEPLOYMENT.md](../../DEPLOYMENT.md) remains useful for learning the deployment pieces, but Terraform is the safer path when you want managed identities, Key Vault references, reproducible resource names, and drift-aware changes.

Before running a production or event deployment, review your organization's privacy, consent, retention, access-control, and export-handling requirements. The app can store player names, player emails, gameplay progress, admin emails, OTP metadata, and CSV exports.

## Prerequisites

- Azure CLI authenticated to the subscription you set in `terraform.tfvars`
- Terraform installed
- Azure Functions Core Tools for backend publishing
- Azure CLI `webapp` commands (built-in) for frontend publishing
- Node.js dependencies in `backend/` for the migration runner

On macOS, install Terraform with:

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

On Windows, install Terraform with:

```powershell
winget install Hashicorp.Terraform
```

## Configure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and replace `admin@test.com` with one or more real bootstrap admin emails.

This deployment uses the existing `rg-m365copilot-game-dev` resource group in `koreacentral`. All regional resources (Function App, App Service, SQL, Managed Redis, Storage, Key Vault, App Insights) are deployed to `koreacentral`. Azure Communication Services is the only global control-plane exception; its `data_location` defaults to `United States` for data residency.

Azure SQL is private-only in this Terraform deployment. The Function App reaches SQL through regional VNet integration, a SQL Private Endpoint, and the linked `privatelink.database.windows.net` zone. The default network ranges are `10.60.0.0/16`, `10.60.1.0/24` for Function integration, and `10.60.2.0/24` for private endpoints; override `virtual_network_address_space`, `function_integration_subnet_address_prefixes`, and `private_endpoint_subnet_address_prefixes` only if they conflict with an existing network plan.

`sql_allowed_ip_ranges` is retained for emergency or temporary public-access workflows only. It does not allow workstation migrations while SQL public network access remains disabled. To run migrations from a workstation, either connect from a network path that can resolve and reach the SQL private endpoint, or temporarily set `sql_public_network_access_enabled=true` with an approved `sql_allowed_ip_ranges` entry and apply the workstation firewall rule as a controlled rollback. Return `sql_public_network_access_enabled` to `false` after migrations are complete.

Key Vault is also private-only by default. Function App Key Vault references use the Terraform-managed user-assigned identity, which has secret `Get`/`List` access, and resolve through the Key Vault Private Endpoint plus `privatelink.vaultcore.azure.net` Private DNS zone. Keep `key_vault_public_network_access_enabled=false` for shared environments. Set it to `true` only as a short-lived bootstrap or rollback measure from an approved workstation, then apply again with `false` after the private endpoint and DNS path are healthy.

Terraform includes the generated frontend App Service hostname in the Function App CORS allow-list automatically and sets credentialed admin cookies to `Secure` and `SameSite=None` for the App Service to Function App cross-origin deployment. Add any production custom frontend domains to `allowed_origins` before planning.

The default Azure Managed Redis SKU is `Balanced_B0` for dev/test cost control. Use `redis_sku_name` to choose a larger Balanced, ComputeOptimized, or FlashOptimized SKU for production throughput and resilience requirements. The default database uses encrypted client traffic, `NoCluster` for compatibility with the app's single-endpoint Redis client, and `AllKeysLRU` eviction for cache-aside entries.

## Sentry and Application Insights

Sentry is the primary application observability workspace for frontend and backend errors, handled operational failures, logs, metrics, traces, session replay, releases, and source maps. Application Insights remains enabled for Azure Functions and App Service platform/runtime diagnostics such as host behavior, invocation telemetry, platform health, and Azure Portal troubleshooting. Do not remove Application Insights when enabling Sentry.

Use one Sentry project for both runtimes and distinguish events with tags: `service=frontend|backend`, `runtime=browser|azure-functions|local-express`, `environment`, and `release`. Use a shared git-SHA release value such as:

```bash
export SENTRY_RELEASE="m365copilot-game@$(git rev-parse --short HEAD)"
```

Sentry Issues mean something is broken. Browser network failures with `status: 0`, frontend/backend `5xx` responses, unexpected handler exceptions, local Express adapter exceptions, and ACS Email operational failures are captured as Issues. Expected workflow `4xx` responses such as validation errors, unauthenticated/admin-denied requests, conflicts, not-found lookups, and rate limits are emitted as structured Sentry Logs plus `api.client_response` metrics by default. Use those logs and metrics for volume, routing, and workflow analysis instead of treating ordinary `4xx` traffic as incidents.

Backend runtime settings are Terraform variables and become Function App settings. Set them in `terraform.tfvars` or pass them as `-var` values:

```hcl
sentry_dsn                      = "https://examplePublicKey@o0.ingest.sentry.io/0"
sentry_environment              = "dev"
sentry_release                  = "m365copilot-game@<git-sha>"
sentry_traces_sample_rate       = 0.1
sentry_enable_logs              = true
sentry_capture_operational_errors = true
sentry_flush_timeout_ms         = 2000
sentry_smoke_check              = false
```

Frontend settings are Vite build-time environment variables. They are baked into the generated static assets, so rebuild and redeploy the frontend when these values change:

```bash
VITE_API_BASE=$(terraform -chdir=../infra/terraform output -raw api_base_url) \
VITE_SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0" \
VITE_SENTRY_ENVIRONMENT="dev" \
VITE_SENTRY_RELEASE="$SENTRY_RELEASE" \
VITE_SENTRY_TRACES_SAMPLE_RATE="0.1" \
VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE="0.01" \
VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE="1.0" \
VITE_SENTRY_REPLAY_UNMASK="false" \
VITE_SENTRY_ENABLE_LOGS="true" \
VITE_SENTRY_SMOKE_CHECK="false" \
npm run build
```

Session replay is masked by default. Set `VITE_SENTRY_REPLAY_UNMASK="true"` only for an approved diagnostic build where the deployer has reviewed privacy, consent, retention, and Sentry access controls; that setting records visible text, input values, and media in replay payloads.

The frontend CSP already permits HTTPS `connect-src`, which allows Sentry ingest, replay, and trace traffic. The local Express adapter allows `sentry-trace` and `baggage` CORS request headers for trace propagation. For Azure, keep the Function App CORS allowed origins aligned with the deployed frontend origin; the app sends trace propagation headers only to configured API targets.

Source-map upload credentials must stay outside Terraform state and source control. Use short-lived CI/CD secrets or local shell environment variables for `SENTRY_AUTH_TOKEN`. The frontend Vite Sentry plugin uploads source maps only when `SENTRY_AUTH_TOKEN` and a release are present:

```bash
cd frontend
SENTRY_AUTH_TOKEN="<token>" \
SENTRY_ORG="voyager163" \
SENTRY_PROJECT="javascript-vue" \
VITE_SENTRY_RELEASE="$SENTRY_RELEASE" \
npm run build
```

The backend TypeScript compiler emits source maps. Build and upload them against the same release:

```bash
cd backend
npm run build
SENTRY_AUTH_TOKEN="<token>" \
SENTRY_ORG="voyager163" \
SENTRY_PROJECT="javascript-vue" \
SENTRY_RELEASE="$SENTRY_RELEASE" \
npm run sentry:sourcemaps
```

If you use Sentry's source-map wizard, run it locally and review every generated change before committing:

```bash
npx @sentry/wizard@latest -i sourcemaps --saas --org voyager163 --project javascript-vue
```

### Controlled Sentry smoke verification

Run this only in an approved non-production environment. Keep `SENTRY_AUTH_TOKEN`, Sentry org/project values, deployment tokens, Function keys, and source-map upload credentials outside Terraform state and source control.

1. Build and upload source maps for one shared release using the frontend and backend commands above.
2. Temporarily enable the backend smoke route by applying `sentry_smoke_check=true` in a non-production Terraform plan, then deploy the backend package for that release.
3. Build and deploy the frontend with `VITE_SENTRY_SMOKE_CHECK="true"` for the same release. Leave `VITE_SENTRY_REPLAY_UNMASK="false"` unless the diagnostic build has a separate privacy approval.
4. Open the deployed frontend, use browser DevTools, and run `window.__m365copilotSentrySmokeCheck()`. It emits `test_counter` and then throws a controlled frontend error.
5. Invoke the backend function-key route and expect an HTTP `500` response because the handler throws after emitting a backend log and metric:

```bash
FUNCTION_APP_NAME=$(terraform -chdir=infra/terraform output -raw function_app_name)
RESOURCE_GROUP_NAME=$(terraform -chdir=infra/terraform output -raw resource_group_name)
FUNCTION_APP_URL=$(terraform -chdir=infra/terraform output -raw function_app_url)
SMOKE_KEY=$(az functionapp function keys list \
	--resource-group "$RESOURCE_GROUP_NAME" \
	--name "$FUNCTION_APP_NAME" \
	--function-name sentrySmoke \
	--query 'default' -o tsv)

curl -i -X POST "$FUNCTION_APP_URL/api/ops/sentry-smoke?code=$SMOKE_KEY"
```

6. Exercise one expected workflow `4xx` path, such as a validation error or denied admin request, and confirm it appears as a Sentry Log plus `api.client_response` metric instead of a new Issue.
7. In Sentry, record evidence for the release: frontend controlled Issue, backend controlled Issue, structured frontend/backend Logs, `test_counter`, `api.client_response`, a trace containing browser-to-API metadata when sampling permits, replay state with masking enabled, and source-map-resolved stack frames for both runtimes.
8. Immediately disable the smoke paths by reverting `sentry_smoke_check=false` and rebuilding/redeploying the frontend with `VITE_SENTRY_SMOKE_CHECK="false"`.

Evidence template:

```text
Release:
Environment:
Frontend controlled Issue:
Backend controlled Issue:
Structured Logs verified:
Metrics verified: test_counter, api.client_response
Trace verified:
Replay state and masking verified:
Frontend source-map stack verified:
Backend source-map stack verified:
Application Insights still available for platform diagnostics:
Smoke paths disabled again:
```

Rollback is configuration-only. Empty or remove `sentry_dsn`/`SENTRY_DSN` to disable backend capture, omit `VITE_SENTRY_DSN` and rebuild to disable frontend capture, set trace and replay sample rates to `0`, set log/metric toggles to `false` where applicable, and remove `SENTRY_AUTH_TOKEN` from the build environment to stop source-map uploads. Leave Application Insights in place for Azure diagnostics.

## Provision

```bash
az login
az account set --subscription "<your-subscription-id>"

terraform init
terraform import azurerm_resource_group.main /subscriptions/<your-subscription-id>/resourceGroups/rg-m365copilot-game-dev
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

This deployment intentionally disables SQL public network access and Key Vault public network access. A full Terraform refresh from an ordinary workstation can fail while reading `azurerm_key_vault_secret` resources with `ForbiddenByConnection`. Prefer running Terraform from an approved network path that can reach the vault. For a known, reviewed graph-only reconciliation, `terraform plan -refresh=false` and `terraform apply -refresh=false` can be used, but review the resulting plan carefully because refreshless runs cannot detect unrelated live drift.

## Deploy Backend Code

```bash
cd ../../backend
npm ci
func azure functionapp publish $(terraform -chdir=../infra/terraform output -raw function_app_name) --javascript
```

Azure Functions Core Tools deploys the backend to the Linux Function App. The deployment uses the standard zip deploy / run-from-package flow.

## Run SQL Migrations

Use the backend migration runner to apply these files against the provisioned database:

1. `database/001-create-tables.sql`
2. `database/002-seed-organizations.sql`
3. `database/003-add-admin-and-campaigns.sql`
4. `database/004-add-progression-scores.sql`
5. `database/005-pack-assignment-lifecycle.sql`
6. `database/006-admin-users.sql`
7. `database/007-active-pack-assignment-counts.sql`
8. `database/008-player-organization-attribution.sql`
9. `database/009-player-owner-token.sql`
10. `database/010-player-recovery.sql`

Run the migrations with Microsoft Entra authentication and grant the Function App managed identity database access:

```bash
SQL_SERVER_FQDN=$(terraform -chdir=infra/terraform output -raw sql_server_fqdn) \
SQL_DATABASE_NAME=$(terraform -chdir=infra/terraform output -raw sql_database_name) \
SQL_AUTHENTICATION=azure-active-directory-default \
SQL_APP_IDENTITY_NAME=$(terraform -chdir=infra/terraform output -raw function_sql_identity_name) \
node backend/scripts/run-migrations.mjs
```

The SQL server is configured for Microsoft Entra-only authentication to satisfy Azure policy. The application connects with the user-assigned managed identity output by Terraform.

## Deploy Frontend

The frontend is hosted on a Linux App Service running Node 24 with `pm2 serve` for SPA routing. Build locally, then publish the `dist/` folder as a zip:

```bash
cd frontend
npm ci
export SENTRY_DSN="<same value as infra/terraform/terraform.tfvars sentry_dsn>"
export SENTRY_RELEASE="m365copilot-game@$(git rev-parse --short HEAD)"
VITE_API_BASE=$(terraform -chdir=../infra/terraform output -raw api_base_url) \
VITE_SENTRY_DSN="$SENTRY_DSN" \
VITE_SENTRY_ENVIRONMENT="dev" \
VITE_SENTRY_RELEASE="$SENTRY_RELEASE" \
npm run build

FRONTEND_APP_NAME=$(terraform -chdir=../infra/terraform output -raw frontend_web_app_name)
RESOURCE_GROUP_NAME=$(terraform -chdir=../infra/terraform output -raw resource_group_name)

(cd dist && zip -r ../dist.zip .)
az webapp deploy \
	--resource-group "$RESOURCE_GROUP_NAME" \
	--name "$FRONTEND_APP_NAME" \
	--src-path dist.zip \
	--type zip
rm dist.zip
```

## Verify

```bash
curl "$(terraform -chdir=infra/terraform output -raw function_app_url)/api/health"
curl "$(terraform -chdir=infra/terraform output -raw function_app_url)/api/leaderboard?campaign=APR26"
curl -X POST "$(terraform -chdir=infra/terraform output -raw function_app_url)/api/portal-api/request-otp" \
	-H 'Content-Type: application/json' \
	--data '{"email":"not-an-admin@example.com"}'
```

Confirm Redis and cookie settings are present without printing secret values:

```bash
az functionapp config appsettings list \
	--name "$(terraform -chdir=infra/terraform output -raw function_app_name)" \
	--resource-group "$(terraform -chdir=infra/terraform output -raw resource_group_name)" \
	--query "[?name=='REDIS_CONNECTION_STRING' || name=='ADMIN_COOKIE_SAMESITE' || name=='ADMIN_COOKIE_SECURE' || name=='ALLOWED_ORIGINS'].{name:name,value:value}" \
	-o table
```

Confirm Key Vault references are resolved without printing app setting values or secret URIs:

```bash
infra/terraform/check-keyvault-references.sh
```

Expected status for `ACS_CONNECTION_STRING`, `ADMIN_KEY`, `JWT_SECRET`, and `REDIS_CONNECTION_STRING` is `Resolved`. If any status is `AccessToKeyVaultDenied`, confirm the Function App uses the `function_key_vault_reference_identity_client_id` output, the identity has Key Vault secret `Get`/`List` permissions, the Key Vault Private Endpoint is approved, and the VNet is linked to `privatelink.vaultcore.azure.net`.

Confirm the private SQL network path is in place and the API health probe can reach the database:

```bash
RESOURCE_GROUP_NAME=$(terraform -chdir=infra/terraform output -raw resource_group_name)
FUNCTION_APP_NAME=$(terraform -chdir=infra/terraform output -raw function_app_name)
SQL_PRIVATE_ENDPOINT_NAME=$(terraform -chdir=infra/terraform output -raw sql_private_endpoint_name)

az functionapp show \
	--resource-group "$RESOURCE_GROUP_NAME" \
	--name "$FUNCTION_APP_NAME" \
	--query "{virtualNetworkSubnetId:virtualNetworkSubnetId,vnetRouteAllEnabled:siteConfig.vnetRouteAllEnabled}" \
	-o json

az network private-endpoint show \
	--resource-group "$RESOURCE_GROUP_NAME" \
	--name "$SQL_PRIVATE_ENDPOINT_NAME" \
	--query "{name:name,state:privateLinkServiceConnections[0].privateLinkServiceConnectionState.status}" \
	-o json

curl "$(terraform -chdir=infra/terraform output -raw function_app_url)/api/health"
```

The health response should include `"status":"healthy"` and `"database":"up"`.

Confirm the private Key Vault network path is in place:

```bash
RESOURCE_GROUP_NAME=$(terraform -chdir=infra/terraform output -raw resource_group_name)
FUNCTION_APP_NAME=$(terraform -chdir=infra/terraform output -raw function_app_name)
KEY_VAULT_PRIVATE_ENDPOINT_NAME=$(terraform -chdir=infra/terraform output -raw key_vault_private_endpoint_name)

az network private-endpoint show \
	--resource-group "$RESOURCE_GROUP_NAME" \
	--name "$KEY_VAULT_PRIVATE_ENDPOINT_NAME" \
	--query "{name:name,state:privateLinkServiceConnections[0].privateLinkServiceConnectionState.status}" \
	-o json

az functionapp show \
	--resource-group "$RESOURCE_GROUP_NAME" \
	--name "$FUNCTION_APP_NAME" \
	--query "{keyVaultReferenceIdentity:keyVaultReferenceIdentity,virtualNetworkSubnetId:virtualNetworkSubnetId,vnetRouteAllEnabled:siteConfig.vnetRouteAllEnabled}" \
	-o json
```

The Function App should show a `keyVaultReferenceIdentity`, a `virtualNetworkSubnetId`, and `vnetRouteAllEnabled: true`; the Key Vault Private Endpoint connection should be `Approved`.

Open the frontend URL:

```bash
terraform -chdir=infra/terraform output -raw frontend_web_app_url
```

Open the frontend, complete onboarding with a test name and email address, and confirm the API assigns a pack and renders the 3x3 board. Admin login is available at `#/admin/login`. The initial bootstrap admin list comes from `admin_emails` in `terraform.tfvars`.

To test ACS Email locally against the real provider, set the same sender and connection string in your shell, start the backend against a local or test database, and request an OTP for an allowed admin email:

```bash
# Terminal 1
cd backend
ACS_CONNECTION_STRING='<acs-connection-string>' \
ACS_EMAIL_SENDER='DoNotReply@<your-verified-email-domain>' \
ADMIN_EMAILS='admin@example.com' \
NODE_ENV=production \
npm start

# Terminal 2
curl -X POST http://localhost:7071/api/portal-api/request-otp \
	-H 'Content-Type: application/json' \
	--data '{"email":"admin@example.com"}'
```

Do not paste literal Key Vault reference strings into local ACS variables. A value that starts with `@Microsoft.KeyVault(` is treated as unresolved configuration and returns `not_configured` before the ACS SDK is constructed. Keep local ACS values in environment variables or an untracked local settings file only; do not commit `local.settings.json`, connection strings, sender secrets, or copied Key Vault reference URIs.

To test admin cookies, open browser DevTools after OTP login and confirm the API response sets `admin_access` and `admin_refresh` cookies as `HttpOnly`, `Secure`, and `SameSite=None`. The frontend should not store JWT token strings in `sessionStorage` or `localStorage`.

## Rollback Notes

- Redis rollback: remove or clear the `REDIS_CONNECTION_STRING` app setting and restart the Function App. API endpoints continue to read from Azure SQL and skip cache writes.
- Cookie/CORS rollback: keep `ADMIN_KEY` configured as the break-glass path for admin API calls. If browser login fails after a domain or CORS change, verify `ALLOWED_ORIGINS`, Function App CORS `support_credentials`, and the `ADMIN_COOKIE_SAMESITE=None`/`ADMIN_COOKIE_SECURE=true` settings before reverting application code.
- Leaderboard rollback: set `LEADERBOARD_SOURCE=submissions`, restart the Function App, and verify the leaderboard endpoint before changing data.
- SQL private networking rollback: temporarily enable SQL public network access and keep the existing firewall rules only long enough to restore service, then fix the Private Endpoint, Private DNS zone link, or Function App VNet integration and return SQL to private-only access.
- Key Vault private networking rollback: set `key_vault_public_network_access_enabled=true` only long enough to restore Function App Key Vault reference resolution or run a controlled Terraform operation from an approved workstation. Return the value to `false` after the Key Vault Private Endpoint, Private DNS zone link, Function App VNet integration, and Key Vault reference identity are healthy.

## Notes

- Key Vault purge protection is enabled. Deleting and recreating the same Key Vault name may require purge permissions and retention waiting time.
- Terraform source does not contain literal secret values or deployment-token outputs.
- Terraform state can still contain generated secret material and provider-returned credentials. Never commit `*.tfstate`, `*.tfvars`, plan files, or generated plan summaries; use a secure remote backend before team or production use.
- Key Vault stores generated app secrets that are referenced by Function App settings. Keep production secrets and deployment tokens out of source control and public issue/PR content.
- CSV exports and deployment logs can include personal or operational data. Handle them according to your organization's policies.
- Storage shared-key access is disabled by policy. Terraform uses Azure AD storage operations, and the Function App deployment storage uses managed identity.
- Azure SQL is deployed in `koreacentral` alongside app resources and is reached privately through the Function App integration subnet, SQL Private Endpoint, and `privatelink.database.windows.net` Private DNS zone. Azure Communication Services is the only global resource exception and uses `data_location` (default `United States`) for data residency.
