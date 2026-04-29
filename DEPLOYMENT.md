# Deploying Copilot Chat Bingo to Azure

This guide walks you through deploying the entire Copilot Chat Bingo application to Azure — from zero to a working public URL. No prior Azure experience is assumed.

For repeatable deployments, prefer the Terraform path in [infra/terraform/README.md](infra/terraform/README.md). This manual Azure CLI guide is useful for learning the moving parts or creating a small standalone deployment. Avoid mixing manual resources into a Terraform-managed environment unless you also import or codify those resources.

The current deployment standard is Korea Central for all regional Azure resources. Azure Communication Services is the only global control-plane exception; its email `data_location` is a data-residency setting, not the app deployment region.

Before using the app with real attendees, review your organization's privacy, consent, retention, access-control, and export-handling requirements. The app can store player names, player emails, gameplay progress, admin emails, OTP metadata, and CSV exports.

## Contents

- [What you will create](#what-you-will-create)
- [Prerequisites](#prerequisites)
- [Step 1 — Install the tools](#step-1--install-the-tools)
- [Step 2 — Log in to Azure](#step-2--log-in-to-azure)
- [Step 3 — Create a Resource Group](#step-3--create-a-resource-group)
- [Step 4 — Create the Azure SQL Database](#step-4--create-the-azure-sql-database)
- [Step 5 — Run the database migrations](#step-5--run-the-database-migrations)
- [Step 6 — Create a Storage Account for the Function App](#step-6--create-a-storage-account-for-the-function-app)
- [Step 7 — Deploy the Azure Functions API](#step-7--deploy-the-azure-functions-api)
- [Step 8 — Deploy the frontend to Azure Static Web Apps](#step-8--deploy-the-frontend-to-azure-static-web-apps)
- [Step 9 — Connect frontend to backend (CORS)](#step-9--connect-frontend-to-backend-cors)
- [Step 10 — Verify everything works](#step-10--verify-everything-works)
- [Optional — Custom domain](#optional--custom-domain)
- [Optional — GitHub Actions CI/CD](#optional--github-actions-cicd)
- [Cost estimate](#cost-estimate)
- [Troubleshooting](#troubleshooting)
- [Tearing it down](#tearing-it-down)

---

## What you will create

| Azure resource                           | Purpose                                                            | Pricing tier                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Resource Group**                       | Container that holds all your resources                            | Free                                                                   |
| **Azure SQL Server + Database**          | Stores players, sessions, submissions, leaderboard                 | Basic (5 DTU) — ~$5/mo                                                 |
| **Azure Cache for Redis**                | Cache-aside layer for public config and leaderboard API responses  | Basic C0 for dev/test; use Standard/Premium for production resilience  |
| **Storage Account**                      | Required by Azure Functions for internal state                     | Standard LRS — pennies/mo                                              |
| **Azure Communication Services + Email** | Sends admin OTP codes for portal login and sensitive admin changes | Usage-based — tiny for event-scale OTP traffic                         |
| **Azure Functions App**                  | Hosts the Node.js API                                              | Consumption plan in this manual guide; Terraform uses the plan selected in `terraform.tfvars` |
| **Azure Static Web App**                 | Hosts the Vue 3 frontend with global CDN and free TLS              | Free tier                                                              |

Total estimated cost: **~$5–7/month plus small email usage charges**. For typical event usage, the SQL database is still the main cost driver.

---

## Prerequisites

You need:

1. An **Azure subscription** — [create a free account](https://azure.microsoft.com/free/) if you don't have one (includes $200 credit).
2. A computer with **Node.js 20.x** installed — [download Node.js](https://nodejs.org/).
3. A **terminal** — Terminal.app (macOS), Windows Terminal, or any shell.
4. An admin email address that can receive OTP messages. For production, you also need an Azure Communication Services Email sender address, either from an Azure-managed domain or a verified custom domain.

---

## Step 1 — Install the tools

You need two command-line tools: the **Azure CLI** and **Azure Functions Core Tools**.

### macOS

```bash
# Install Azure CLI
brew install azure-cli

# Install Azure Functions Core Tools v4
brew tap azure/functions
brew install azure-functions-core-tools@4
```

### Windows

```powershell
# Install Azure CLI
winget install Microsoft.AzureCLI

# Install Azure Functions Core Tools v4
winget install Microsoft.Azure.FunctionsCoreTools
```

### Linux (Ubuntu/Debian)

```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Azure Functions Core Tools v4
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

### Verify installation

```bash
az --version       # should show 2.x
func --version     # should show 4.x
node --version     # should show v20.x or later
```

---

## Step 2 — Log in to Azure

```bash
az login
```

A browser window opens. Sign in with your Azure account. Once logged in, the terminal shows your subscription details.

If you have multiple subscriptions, pick the one you want to use:

```bash
# List subscriptions
az account list --output table

# Set the active subscription
az account set --subscription "<subscription-name-or-id>"
```

---

## Step 3 — Create a Resource Group

A Resource Group is a folder that holds all related Azure resources. It makes cleanup easy — deleting the group deletes everything inside it.

```bash
az group create --name rg-bingo --location koreacentral
```

> **Tip:** Keep this deployment in `koreacentral` unless you are intentionally creating a separate manual environment. Azure Communication Services is the only global control-plane exception.

---

## Step 4 — Create the Azure SQL Database

### 4a. Create the SQL server

```bash
az sql server create \
  --name sql-bingo-server \
  --resource-group rg-bingo \
  --location koreacentral \
  --admin-user bingoadmin \
  --admin-password '<YourStrongPassword123!>'
```

> **Important:** Replace `<YourStrongPassword123!>` with a strong password. It must be at least 8 characters and include uppercase, lowercase, numbers, and special characters. **Save this password** — you will need it later.

> **Note:** The server name must be globally unique. If `sql-bingo-server` is taken, try something like `sql-bingo-yourname`.

### 4b. Allow Azure services to connect

```bash
az sql server firewall-rule create \
  --resource-group rg-bingo \
  --server sql-bingo-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 4c. (Optional) Allow your local machine to connect

If you want to run the SQL migration scripts from your local machine:

```bash
# Get your public IP
MY_IP=$(curl -s https://api.ipify.org)

az sql server firewall-rule create \
  --resource-group rg-bingo \
  --server sql-bingo-server \
  --name AllowMyIP \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP"
```

### 4d. Create the database

```bash
az sql db create \
  --resource-group rg-bingo \
  --server sql-bingo-server \
  --name bingo_db \
  --edition Basic \
  --capacity 5
```

### 4e. Note your connection string

You will need this for the Function App configuration. Your connection string is:

```
Server=tcp:sql-bingo-server.database.windows.net,1433;Initial Catalog=bingo_db;User ID=bingoadmin;Password=<YourStrongPassword123!>;Encrypt=true;TrustServerCertificate=false;
```

Replace `sql-bingo-server` with your actual server name and the password with the one you chose.

---

## Step 5 — Run the database migrations

The database needs eight SQL scripts to create the tables, seed organization data, add campaign/admin support, add progression-scoring storage, add pack-assignment lifecycle storage, add portal-managed admin users, add active pack assignment lookup support, and persist player organization attribution.

### Option A — Azure Portal Query Editor (easiest, no extra tools)

1. Go to [portal.azure.com](https://portal.azure.com).
2. Navigate to **Resource groups → rg-bingo → bingo_db** (the database, not the server).
3. In the left menu, click **Query editor (preview)**.
4. Log in with the SQL admin username (`bingoadmin`) and password.
5. Paste the contents of `database/001-create-tables.sql` into the editor and click **Run**.
6. Paste the contents of `database/002-seed-organizations.sql` into the editor and click **Run**.
7. Paste the contents of `database/003-add-admin-and-campaigns.sql` into the editor and click **Run**.
8. Paste the contents of `database/004-add-progression-scores.sql` into the editor and click **Run**.
9. Paste the contents of `database/005-pack-assignment-lifecycle.sql` into the editor and click **Run**.
10. Paste the contents of `database/006-admin-users.sql` into the editor and click **Run**.
11. Paste the contents of `database/007-active-pack-assignment-counts.sql` into the editor and click **Run**.
12. Paste the contents of `database/008-player-organization-attribution.sql` into the editor and click **Run**.

### Option B — sqlcmd (command line)

```bash
# Install sqlcmd if not already available
# macOS: brew install sqlcmd
# Windows: included with SQL Server tools
# Linux: https://learn.microsoft.com/sql/linux/sql-server-linux-setup-tools

# Run the migration scripts
sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/001-create-tables.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/002-seed-organizations.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/003-add-admin-and-campaigns.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/004-add-progression-scores.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/005-pack-assignment-lifecycle.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/006-admin-users.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/007-active-pack-assignment-counts.sql

sqlcmd -S sql-bingo-server.database.windows.net \
  -d bingo_db \
  -U bingoadmin \
  -P '<YourStrongPassword123!>' \
  -i database/008-player-organization-attribution.sql
```

### Option C — Azure Data Studio (GUI)

1. Download [Azure Data Studio](https://learn.microsoft.com/azure-data-studio/download-azure-data-studio).
2. Connect to `sql-bingo-server.database.windows.net` with the admin credentials.
3. Open and execute each SQL file in order.

---

## Step 6 — Create a Storage Account for the Function App

Azure Functions needs a Storage Account to manage its internal state (triggers, logging, etc.). This is **not** where the frontend is hosted.

```bash
az storage account create \
  --name stbingofunc \
  --resource-group rg-bingo \
  --location koreacentral \
  --sku Standard_LRS \
  --kind StorageV2
```

> **Note:** Storage account names must be globally unique, 3–24 characters, lowercase letters and numbers only. If `stbingofunc` is taken, try `stbingofunc123` or similar.

---

## Step 7 — Deploy the Azure Functions API

### 7a. Create the Function App

```bash
az functionapp create \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --storage-account stbingofunc \
  --consumption-plan-location koreacentral \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux
```

> **Note:** The function app name must be globally unique (it becomes part of the URL). If `func-bingo-api` is taken, try `func-bingo-api-yourname`.

### 7b. Create or identify the ACS Email sender

Admin portal login depends on email OTP delivery. In production, configure Azure Communication Services Email before setting Function App settings.

1. In [portal.azure.com](https://portal.azure.com), create an **Azure Communication Services** resource in `rg-bingo`.
2. Open the Communication Services resource and create or connect an **Email Communication Service**.
3. For the fastest event setup, add an Azure-managed email domain. For branded mail, connect a custom domain and complete the required DNS verification.
4. Copy the sender address, such as `DoNotReply@<your-verified-email-domain>`. This becomes `ACS_EMAIL_SENDER`.
5. In the Communication Services resource, open **Keys** and copy a connection string. This becomes `ACS_CONNECTION_STRING`.

> **Important:** OTP email sending fails in production if either `ACS_CONNECTION_STRING` or `ACS_EMAIL_SENDER` is missing. The backend invalidates any OTP row whose email send fails, so users must request a fresh code after a provider or configuration issue is fixed.

> **Region note:** Azure Communication Services is globally scoped. Choose the email data location required by your tenancy; the Terraform template defaults `communication_data_location` to `United States` while all regional app resources remain in Korea Central.

### 7c. Create Redis cache

Redis is used as a disposable cache-aside layer. Azure SQL remains the source of truth, and the API falls back to SQL if Redis is unavailable.

```bash
az redis create \
  --name redis-bingo-api \
  --resource-group rg-bingo \
  --location koreacentral \
  --sku Basic \
  --vm-size c0 \
  --minimum-tls-version 1.2

REDIS_KEY=$(az redis list-keys \
  --name redis-bingo-api \
  --resource-group rg-bingo \
  --query primaryKey -o tsv)
```

For production, choose a SKU that matches your availability and network requirements, and store the Redis connection string in Key Vault or app settings rather than scripts or source files.

### 7d. Configure app settings

Set the SQL connection string, admin secrets, ACS Email settings, Redis connection string, and cookie/CORS settings:

```bash
az functionapp config appsettings set \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --settings \
    "SQL_CONNECTION_STRING=Server=tcp:sql-bingo-server.database.windows.net,1433;Initial Catalog=bingo_db;User ID=bingoadmin;Password=<YourStrongPassword123!>;Encrypt=true;TrustServerCertificate=false;" \
    "ADMIN_KEY=<pick-a-strong-secret-for-admin-access>" \
    "JWT_SECRET=<random-64-character-string-for-jwt-signing>" \
    "ADMIN_EMAILS=admin1@example.com,admin2@example.com" \
    "ADMIN_ACCESS_TTL_SECONDS=900" \
    "ADMIN_REFRESH_TTL_SECONDS=604800" \
    "ADMIN_STEP_UP_TTL_SECONDS=300" \
    "ADMIN_COOKIE_SECURE=true" \
    "ADMIN_COOKIE_SAMESITE=None" \
    "ADMIN_COOKIE_PATH=/api/portal-api" \
    "ALLOWED_ORIGINS=https://<your-swa-name>.azurestaticapps.net" \
    "ACS_CONNECTION_STRING=<your-azure-communication-services-connection-string>" \
    "ACS_EMAIL_SENDER=DoNotReply@<your-verified-email-domain>" \
    "REDIS_CONNECTION_STRING=rediss://:${REDIS_KEY}@redis-bingo-api.redis.cache.windows.net:6380" \
    "CACHE_TTL_ACTIVE_CAMPAIGN_SECONDS=60" \
    "CACHE_TTL_ORG_DOMAINS_SECONDS=300" \
    "CACHE_TTL_LEADERBOARD_SECONDS=30" \
    "DEFAULT_CAMPAIGN_ID=APR26" \
    "LEADERBOARD_SOURCE=progression" \
    "ENABLE_PACK_ASSIGNMENT_LIFECYCLE=true"
```

> **Important:** Replace the password and choose strong values for `ADMIN_KEY` and `JWT_SECRET`. The admin key is used for CLI/API break-glass access to admin endpoints. `JWT_SECRET` signs admin access, refresh, and step-up cookies. `ADMIN_EMAILS` is a comma-separated bootstrap/break-glass list of emails allowed to log into the admin portal via OTP; portal-managed admins are stored in the database. `ACS_CONNECTION_STRING`, `ACS_EMAIL_SENDER`, and `REDIS_CONNECTION_STRING` configure production dependencies. Keep all secrets confidential.

> **Cookie settings:** When the frontend and Function App are on different hostnames, keep `ADMIN_COOKIE_SECURE=true` and `ADMIN_COOKIE_SAMESITE=None`, and configure credentialed CORS for the frontend origin. For localhost only, use `ADMIN_COOKIE_SECURE=false` and `ADMIN_COOKIE_SAMESITE=Lax`.

> **Scoring source toggle:** `LEADERBOARD_SOURCE=progression` enables verified gameplay progression scoring. Set `LEADERBOARD_SOURCE=submissions` to temporarily roll back to legacy submission-based leaderboard aggregation.
> **Pack lifecycle toggle:** `ENABLE_PACK_ASSIGNMENT_LIFECYCLE=true` enables server-authoritative pack assignment and 7-week completion rotation. Set `ENABLE_PACK_ASSIGNMENT_LIFECYCLE=false` to temporarily roll back to legacy manual pack selection behavior.

### 7e. Deploy the backend code

```bash
cd backend
npm ci
func azure functionapp publish func-bingo-api
```

This packages your backend code and uploads it to Azure. It takes about a minute. When done, you will see output listing all the deployed function endpoints.

### 7f. Verify the API is running

```bash
curl https://func-bingo-api.azurewebsites.net/api/leaderboard?campaign=APR26
```

You should get an empty JSON array `[]` (no submissions yet). If you get an error, see [Troubleshooting](#troubleshooting).

---

## Step 8 — Deploy the frontend to Azure Static Web Apps

Azure Static Web Apps gives you a global CDN, free TLS certificate, and PR preview environments — all for free.

### 8a. Create the Static Web App resource

```bash
az staticwebapp create \
  --name swa-bingo \
  --resource-group rg-bingo \
  --location koreacentral \
  --sku Free
```

### 8b. Build the frontend

Point the frontend at your Function App URL:

```bash
cd frontend
npm ci
VITE_API_BASE=https://func-bingo-api.azurewebsites.net/api npm run build
```

> **Important:** Replace `func-bingo-api` with your actual Function App name from Step 7a.

### 8c. Confirm the SPA fallback config

The repository includes `frontend/public/staticwebapp.config.json` so that page refreshes don't return 404. Vite copies everything in `public/` into `dist/` on every build. The file should contain:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "*.{css,js,svg,png,jpg,ico,woff,woff2}"]
  },
  "globalHeaders": {
    "Cache-Control": "no-cache"
  }
}
```

If you already built before pulling the latest repository changes, rebuild so the file is copied into `frontend/dist/`.

### 8d. Deploy with the SWA CLI

```bash
# Install the Static Web Apps CLI globally
npm install -g @azure/static-web-apps-cli

# Get the deployment token and deploy the built frontend.
SWA_CLI_DEPLOYMENT_TOKEN="$(az staticwebapp secrets list \
  --name swa-bingo \
  --resource-group rg-bingo \
  --query 'properties.apiKey' -o tsv)" \
swa deploy frontend/dist --deployment-token "$SWA_CLI_DEPLOYMENT_TOKEN"
```

### 8e. Get your site URL

```bash
az staticwebapp show \
  --name swa-bingo \
  --resource-group rg-bingo \
  --query "defaultHostname" -o tsv
```

Your site is live at `https://<generated-name>.azurestaticapps.net`.

---

## Step 9 — Connect frontend to backend (CORS)

The Function App needs to allow requests from the Static Web App domain. Get your SWA URL from the previous step and configure CORS:

```bash
az functionapp cors add \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --allowed-origins "https://<your-swa-name>.azurestaticapps.net"

az functionapp cors credentials \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --enable true
```

> Replace `<your-swa-name>.azurestaticapps.net` with the actual URL from Step 8e.

---

## Step 10 — Verify everything works

Open your Static Web App URL in a browser and check:

| #   | What to check              | Expected result                                                                                                                               |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | App loads                  | You see the **Game**, **Keywords**, **Activity**, and **Help** tabs                                                                           |
| 2   | Start a game               | Complete onboarding identity (name + email); the API assigns a pack and the 3×3 board appears                                                 |
| 3   | Assigned pack persists     | Reload the page and confirm the same assigned pack is restored                                                                                |
| 4   | Progress persists          | Cleared tiles, earned keywords, and challenge progress are restored                                                                           |
| 5   | Verify progression scoring | Clear a line and confirm `POST` to `/api/events` with `line_won` and leaderboard refresh                                                      |
| 6   | Leaderboard                | Visit the Activity tab — leaderboard and timeline show score events                                                                           |
| 7   | No console errors          | Browser DevTools → Console shows no errors                                                                                                    |
| 8   | Admin dashboard            | `curl -H "X-Admin-Key: <your-key>" https://func-bingo-api.azurewebsites.net/api/portal-api/dashboard?campaign=APR26` returns engagement data  |
| 9   | Admin OTP login            | Visit `https://<your-swa-name>.azurestaticapps.net/#/admin/login`, request a code for an email in `ADMIN_EMAILS`, and verify the portal opens |
| 10  | Admin access management    | In **Admin Access**, confirm bootstrap admins are read-only and adding/disabling a portal-managed admin requires re-entering an OTP           |

After OTP login, browser DevTools should show `admin_access` and `admin_refresh` cookies set by the Function App as `HttpOnly`, `Secure`, and `SameSite=None`. JWT token strings should not appear in `sessionStorage` or `localStorage`.

### Admin access runbook

- Keep at least one known-good email in `ADMIN_EMAILS` as bootstrap/break-glass access.
- Use the portal **Admin Access** view for day-to-day admin additions and removals.
- Bootstrap admins are managed in Function App settings, so they cannot be removed from the portal.
- Portal-managed admin changes require a fresh OTP sent to the acting admin and scoped to the exact add/remove action.
- If ACS Email has an outage or is misconfigured, allow-listed admins receive a provider failure instead of being sent to an OTP entry screen with no code.

### Progression scoring cutover and rollback runbook

1. Deploy backend with `LEADERBOARD_SOURCE=submissions` first.
2. Apply `database/004-add-progression-scores.sql`.
3. Deploy frontend/backend changes that emit and consume progression score events.
4. Validate parity in staging:

- Compare `GET /api/leaderboard` output with `LEADERBOARD_SOURCE=submissions` vs `LEADERBOARD_SOURCE=progression`.
- Confirm admin dashboard totals match leaderboard totals in both modes.

5. Switch production app setting to `LEADERBOARD_SOURCE=progression`.
6. Monitor leaderboard/admin parity and API error rates.

Rollback:

1. Set app setting `LEADERBOARD_SOURCE=submissions`.
2. Restart Function App.
3. Verify leaderboard and admin dashboard return legacy submission-based totals.
4. Keep progression score data for reconciliation; do not drop new tables during rollback.

### Redis and auth-cookie rollback runbook

- Redis: clear or remove `REDIS_CONNECTION_STRING` and restart the Function App. The API will skip Redis and read from Azure SQL.
- Admin cookies: keep `ADMIN_KEY` configured so operators can use the break-glass API path while investigating login issues.
- Credentialed CORS: if admin login sets cookies but authenticated requests fail, verify the Static Web App origin is in Function App CORS, `support credentials` is enabled, and app settings keep `ADMIN_COOKIE_SAMESITE=None` plus `ADMIN_COOKIE_SECURE=true` for production.

---

## Optional — Custom domain

### For the Static Web App (frontend)

1. Go to [portal.azure.com](https://portal.azure.com) → your Static Web App → **Custom domains**.
2. Click **Add** and follow the CNAME or TXT validation steps.
3. TLS is provisioned automatically (no certificate to upload).

### For the Function App (API)

1. Go to your Function App → **Custom domains** → **Add custom domain**.
2. Follow the DNS validation steps.
3. Add a TLS binding (Azure provides free managed certificates for Function Apps).

If you add a custom domain to the Function App, rebuild the frontend with the new API URL:

```bash
VITE_API_BASE=https://api.yourdomain.com/api npm run build
```

And redeploy the frontend.

---

## Optional — GitHub Actions CI/CD

Automate deployments so every push to `main` builds and deploys both frontend and backend.

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AZURE_FUNCTIONAPP_NAME: func-bingo-api
  SWA_NAME: swa-bingo
  RESOURCE_GROUP: rg-bingo
  NODE_VERSION: '20'

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
        working-directory: backend
      - uses: Azure/functions-action@v1
        with:
          app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
          package: backend
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
        env:
          VITE_API_BASE: https://${{ env.AZURE_FUNCTIONAPP_NAME }}.azurewebsites.net/api
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.SWA_DEPLOYMENT_TOKEN }}
          action: upload
          app_location: frontend/dist
          skip_app_build: true
```

### Set up the secrets

1. **`AZURE_FUNCTIONAPP_PUBLISH_PROFILE`**: In the Azure Portal, go to your Function App → **Overview** → **Get publish profile**. Copy the XML content and add it as a GitHub secret.

2. **`SWA_DEPLOYMENT_TOKEN`**: Run this command and add the output as a GitHub secret:
   ```bash
   az staticwebapp secrets list \
     --name swa-bingo \
     --resource-group rg-bingo \
     --query 'properties.apiKey' -o tsv
   ```

Protect GitHub Actions secrets, deployment tokens, publish profiles, Terraform state, generated plans, and CSV exports according to your organization's security and data-handling policies.

---

## Cost estimate

For a typical event (hundreds of players over a few days):

| Resource                           | Tier                            | Estimated monthly cost           |
| ---------------------------------- | ------------------------------- | -------------------------------- |
| Azure SQL Database                 | Basic (5 DTU)                   | ~$5                              |
| Azure Cache for Redis              | Basic C0                        | Low single-digit dollars/month   |
| Azure Functions                    | Consumption (pay-per-execution) | Free (1M executions/mo included) |
| Storage Account                    | Standard LRS                    | < $0.10                          |
| Azure Communication Services Email | Usage-based                     | Small, depends on OTP volume     |
| Azure Static Web Apps              | Free                            | $0                               |
| **Total**                          |                                 | **~$5/month plus email usage**   |

> After the event, you can [tear down](#tearing-it-down) the resources to stop all charges immediately.

---

## Troubleshooting

### "az: command not found"

The Azure CLI is not installed. Follow the [install steps](#step-1--install-the-tools) for your OS.

### "func: command not found"

Azure Functions Core Tools is not installed. Follow the [install steps](#step-1--install-the-tools) for your OS.

### API returns 500 Internal Server Error

The most common cause is a bad SQL connection string. Check:

```bash
# View the current app settings
az functionapp config appsettings list \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --output table
```

Verify `SQL_CONNECTION_STRING` has the correct server name, database name, username, and password. Also confirm the firewall rule from Step 4b was created.

### Admin OTP request returns "Could not send verification code"

The email provider failed after the admin email was accepted. Check these settings on the Function App:

```bash
az functionapp config appsettings list \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --query "[?name=='ACS_CONNECTION_STRING' || name=='ACS_EMAIL_SENDER' || name=='ADMIN_EMAILS']" \
  --output table
```

Confirm `ACS_CONNECTION_STRING` is from the Communication Services resource, `ACS_EMAIL_SENDER` exactly matches a verified sender address, and the requesting email is in `ADMIN_EMAILS` or active in the portal-managed admin list. After fixing settings, request a new OTP; failed-send OTPs are invalidated and cannot be reused.

### Admin can log in but cannot add or disable admins

Admin add/remove operations require a fresh OTP step-up from the Admin Access view. Request the step-up code, enter it before it expires, and retry the change. Bootstrap admins from `ADMIN_EMAILS` are read-only in the portal and must be changed through Function App settings.

### API returns 404 for all routes

Make sure you deployed from the `backend/` directory and that `host.json` includes `"routePrefix": "api"`. Redeploy:

```bash
cd backend
func azure functionapp publish func-bingo-api
```

### Frontend loads but API calls fail (CORS errors)

Check the browser DevTools Console for `Access-Control-Allow-Origin` errors. You need to add the frontend URL to the Function App's CORS list:

```bash
az functionapp cors add \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --allowed-origins "https://<your-swa-name>.azurestaticapps.net"
```

### Blank page after deploy

The frontend was built with the wrong `base` path. If your SWA serves from the root domain, the default `base: '/'` is correct. If served from a subpath, set `base` in `frontend/vite.config.js`:

```js
export default defineConfig({
  base: '/your-subpath/',
  plugins: [vue(), tailwindcss()],
});
```

Rebuild and redeploy.

### Page refresh returns 404

The SPA fallback is not configured. Make sure `staticwebapp.config.json` is in the deployed output. See [Step 8c](#8c-create-the-spa-fallback-config).

### Player progress disappears after deploy

`localStorage` is partitioned by origin (scheme + host). Switching from `http://` to `https://`, or changing the domain, will appear as data loss. Ensure the site is served from the same origin as before.

### Database migration fails with "firewall" error

Your local IP is not allowed. Add it:

```bash
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group rg-bingo \
  --server sql-bingo-server \
  --name AllowMyIP \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP"
```

### Resource name already taken

Azure resource names must be globally unique. Append a random suffix:

- SQL Server: `sql-bingo-server-abc123`
- Function App: `func-bingo-api-abc123`
- Storage Account: `stbingofunc123`

Update all subsequent commands with the name you chose.

---

## Tearing it down

When you no longer need the deployment, delete the entire resource group to remove all resources and stop all charges:

```bash
az group delete --name rg-bingo --yes --no-wait
```

---

## Operational runbook: enabling player session token enforcement

The backend issues an opaque `playerToken` to every player on `POST /api/sessions`, stored as a SHA-256 hash in `players.owner_token`. When `ENABLE_PLAYER_TOKEN_ENFORCEMENT=true`, the API rejects any `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, or `GET /api/player/state` call whose token does not match the owning player.

To avoid breaking existing players whose `owner_token` has not yet been claimed, deploy in two stages:

1. **Bake stage (issuance only)** — deploy the migration `009-player-owner-token.sql`, the new backend, and the new frontend with `enable_player_token_enforcement = false` (Terraform default). In this state:
   - `POST /api/sessions` issues and stores the token.
   - All other endpoints accept token-less calls (legacy behaviour).
   - The frontend captures and forwards the token, so subsequent calls from up-to-date browsers already include it.
   - Watch App Insights for `players` rows whose `owner_token` becomes non-null over the bake window. A 24-hour bake window covers most active players.

2. **Flip stage (enforce)** — set the Function App app setting `ENABLE_PLAYER_TOKEN_ENFORCEMENT=true` (no redeploy needed):

   ```bash
   az functionapp config appsettings set \
     --name <func-app-name> \
     --resource-group <rg-name> \
     --settings ENABLE_PLAYER_TOKEN_ENFORCEMENT=true
   ```

   Then update Terraform state by setting `enable_player_token_enforcement = true` in `terraform.tfvars` and running `terraform apply` so the change is reflected in IaC.

   Monitor the 401 rate on `POST /api/events` for the next ~5 minutes. A small spike from stale tabs is expected; alert if it exceeds ~2 % of game-endpoint traffic for more than 5 minutes.

3. **Rollback** — if regressions appear, set the same setting back to `false`. Issuance keeps running so the column stays populated and a future re-flip works without another bake.

### Support recovery: re-claiming a player identity

If a legitimate player loses their token (e.g. cleared browser storage, then opens the SPA in a different browser before their cookie returned) and sees `409 Identity in use` from `POST /api/sessions`, an admin can clear the row's token so the player can re-claim it on next visit:

```sql
UPDATE players
SET owner_token = NULL
WHERE email = '<player-email>';
```

The next `POST /api/sessions` from that player will atomically claim a fresh token.


This deletes the SQL server, database, function app, storage account, and static web app — everything created in this guide. The `--no-wait` flag returns immediately; deletion happens in the background and takes a few minutes.

---

## Quick reference — All resource names

| Resource        | Default name       | Customizable?                                |
| --------------- | ------------------ | -------------------------------------------- |
| Resource Group  | `rg-bingo`         | Yes                                          |
| SQL Server      | `sql-bingo-server` | Yes (globally unique)                        |
| SQL Database    | `bingo_db`         | Yes                                          |
| Storage Account | `stbingofunc`      | Yes (globally unique, lowercase, no hyphens) |
| Function App    | `func-bingo-api`   | Yes (globally unique)                        |
| Static Web App  | `swa-bingo`        | Yes                                          |

If you change any name, update it consistently in all subsequent commands.
