# Terraform Infrastructure

This folder provisions the Azure resources needed by Copilot Chat Bingo.

## What It Creates

- Resource group `rg-m365copilot-game-dev` in `koreacentral`
- Linux Azure App Service hosting the Vue frontend (built static assets)
- Linux Azure Function App on a Functions Premium (Elastic Premium / EP) plan for the Node.js API
- Storage Account required by Azure Functions
- Azure SQL Server and `bingo_db` database (Korea Central)
- Azure Redis cache for cache-aside API responses
- Azure Communication Services and Email Communication Service with an Azure-managed sender domain
  - ACS `data_location` defaults to `United States` because the service is not available in every region; this is an intentional regional exception to the Korea Central default.
- Key Vault for generated app secrets
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

This deployment uses the existing `rg-m365copilot-game-dev` resource group in `koreacentral`. All app resources (Function App, App Service, SQL, Redis, Storage, Key Vault, App Insights) are deployed to `koreacentral`. Azure Communication Services keeps its `data_location` outside Korea Central (default `United States`) because the service is not available in every region.

If you want to run SQL migrations from your workstation, add your public IP to `sql_allowed_ip_ranges`.

Terraform includes the generated frontend App Service hostname in the Function App CORS allow-list automatically and sets credentialed admin cookies to `Secure` and `SameSite=None` for the App Service to Function App cross-origin deployment. Add any production custom frontend domains to `allowed_origins` before planning.

The default Redis SKU is Basic C0 for dev/test cost control. Use `redis_sku_name`, `redis_family`, and `redis_capacity` to choose Standard or Premium for production resilience requirements.

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

## Deploy Backend Code

```bash
cd ../../backend
npm ci
func azure functionapp publish $(terraform -chdir=../infra/terraform output -raw function_app_name) --javascript
```

Azure Functions Core Tools deploys the backend to the Premium-plan Function App. The deployment uses the standard zip deploy / run-from-package flow.

## Run SQL Migrations

Use the backend migration runner to apply these files against the provisioned database:

1. `database/001-create-tables.sql`
2. `database/002-seed-organizations.sql`
3. `database/003-add-admin-and-campaigns.sql`
4. `database/004-add-progression-scores.sql`
5. `database/005-pack-assignment-lifecycle.sql`
6. `database/006-admin-users.sql`
7. `database/007-active-pack-assignment-counts.sql`

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

The frontend is hosted on a Linux App Service running Node 20 with `pm2 serve` for SPA routing. Build locally, then publish the `dist/` folder as a zip:

```bash
cd frontend
npm ci
VITE_API_BASE=$(terraform -chdir=../infra/terraform output -raw api_base_url) npm run build

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

Open the frontend URL:

```bash
terraform -chdir=infra/terraform output -raw frontend_web_app_url
```

Open the frontend, complete onboarding with a test name and email address, and confirm the API assigns a pack and renders the 3x3 board. Admin login is available at `#/admin/login`. The initial bootstrap admin list comes from `admin_emails` in `terraform.tfvars`.

To test admin cookies, open browser DevTools after OTP login and confirm the API response sets `admin_access` and `admin_refresh` cookies as `HttpOnly`, `Secure`, and `SameSite=None`. The frontend should not store JWT token strings in `sessionStorage` or `localStorage`.

## Rollback Notes

- Redis rollback: remove or clear the `REDIS_CONNECTION_STRING` app setting and restart the Function App. API endpoints continue to read from Azure SQL and skip cache writes.
- Cookie/CORS rollback: keep `ADMIN_KEY` configured as the break-glass path for admin API calls. If browser login fails after a domain or CORS change, verify `ALLOWED_ORIGINS`, Function App CORS `support_credentials`, and the `ADMIN_COOKIE_SAMESITE=None`/`ADMIN_COOKIE_SECURE=true` settings before reverting application code.
- Leaderboard rollback: set `LEADERBOARD_SOURCE=submissions`, restart the Function App, and verify the leaderboard endpoint before changing data.

## Notes

- Key Vault purge protection is enabled. Deleting and recreating the same Key Vault name may require purge permissions and retention waiting time.
- Terraform source does not contain literal secret values or deployment-token outputs.
- Terraform state can still contain generated secret material and provider-returned credentials. Never commit `*.tfstate`, `*.tfvars`, plan files, or generated plan summaries; use a secure remote backend before team or production use.
- Key Vault stores generated app secrets that are referenced by Function App settings. Keep production secrets and deployment tokens out of source control and public issue/PR content.
- CSV exports and deployment logs can include personal or operational data. Handle them according to your organization's policies.
- Storage shared-key access is disabled by policy. Terraform uses Azure AD storage operations, and the Function App deployment storage uses managed identity.
- Azure SQL is deployed in `koreacentral` alongside app resources. Azure Communication Services intentionally uses a non-Korea `data_location` (default `United States`) because the service is not available in every region.
