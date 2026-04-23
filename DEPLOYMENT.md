# Deploying Copilot Chat Bingo to Azure

This guide walks you through deploying the entire Copilot Chat Bingo application to Azure — from zero to a working public URL. No prior Azure experience is assumed.

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

| Azure resource | Purpose | Pricing tier |
|---|---|---|
| **Resource Group** | Container that holds all your resources | Free |
| **Azure SQL Server + Database** | Stores players, sessions, submissions, leaderboard | Basic (5 DTU) — ~$5/mo |
| **Storage Account** | Required by Azure Functions for internal state | Standard LRS — pennies/mo |
| **Azure Functions App** | Hosts the Node.js API (7 endpoints) | Consumption plan — free tier covers most usage |
| **Azure Static Web App** | Hosts the Vue 3 frontend with global CDN and free TLS | Free tier |

Total estimated cost: **~$5–7/month** (the SQL database is the only paid component; everything else fits in free tiers for typical event usage).

---

## Prerequisites

You need:

1. An **Azure subscription** — [create a free account](https://azure.microsoft.com/free/) if you don't have one (includes $200 credit).
2. A computer with **Node.js 20.x** installed — [download Node.js](https://nodejs.org/).
3. A **terminal** — Terminal.app (macOS), Windows Terminal, or any shell.

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
az group create --name rg-bingo --location eastus2
```

> **Tip:** You can use any [Azure region](https://azure.microsoft.com/explore/global-infrastructure/geographies/). Pick one close to your players for lower latency. Common choices: `eastus2`, `westus2`, `southeastasia`, `westeurope`.

---

## Step 4 — Create the Azure SQL Database

### 4a. Create the SQL server

```bash
az sql server create \
  --name sql-bingo-server \
  --resource-group rg-bingo \
  --location eastus2 \
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
  --name bingodb \
  --edition Basic \
  --capacity 5
```

### 4e. Note your connection string

You will need this for the Function App configuration. Your connection string is:

```
Server=tcp:sql-bingo-server.database.windows.net,1433;Initial Catalog=bingodb;User ID=bingoadmin;Password=<YourStrongPassword123!>;Encrypt=true;TrustServerCertificate=false;
```

Replace `sql-bingo-server` with your actual server name and the password with the one you chose.

---

## Step 5 — Run the database migrations

The database needs two SQL scripts to create the tables and seed the organization data.

### Option A — Azure Portal Query Editor (easiest, no extra tools)

1. Go to [portal.azure.com](https://portal.azure.com).
2. Navigate to **Resource groups → rg-bingo → bingodb** (the database, not the server).
3. In the left menu, click **Query editor (preview)**.
4. Log in with the SQL admin username (`bingoadmin`) and password.
5. Paste the contents of `database/001-create-tables.sql` into the editor and click **Run**.
6. Paste the contents of `database/002-seed-organizations.sql` into the editor and click **Run**.

### Option B — sqlcmd (command line)

```bash
# Install sqlcmd if not already available
# macOS: brew install sqlcmd
# Windows: included with SQL Server tools
# Linux: https://learn.microsoft.com/sql/linux/sql-server-linux-setup-tools

# Run the migration scripts
sqlcmd -S sql-bingo-server.database.windows.net \
       -d bingodb \
       -U bingoadmin \
       -P '<YourStrongPassword123!>' \
       -i database/001-create-tables.sql

sqlcmd -S sql-bingo-server.database.windows.net \
       -d bingodb \
       -U bingoadmin \
       -P '<YourStrongPassword123!>' \
       -i database/002-seed-organizations.sql
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
  --location eastus2 \
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
  --consumption-plan-location eastus2 \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux
```

> **Note:** The function app name must be globally unique (it becomes part of the URL). If `func-bingo-api` is taken, try `func-bingo-api-yourname`.

### 7b. Configure app settings

Set the SQL connection string and admin key:

```bash
az functionapp config appsettings set \
  --name func-bingo-api \
  --resource-group rg-bingo \
  --settings \
    "SQL_CONNECTION_STRING=Server=tcp:sql-bingo-server.database.windows.net,1433;Initial Catalog=bingodb;User ID=bingoadmin;Password=<YourStrongPassword123!>;Encrypt=true;TrustServerCertificate=false;" \
    "ADMIN_KEY=<pick-a-strong-secret-for-admin-access>"
```

> **Important:** Replace the password and choose a strong `ADMIN_KEY`. The admin key is used to access the admin dashboard and CSV export endpoints. Keep it secret.

### 7c. Deploy the backend code

```bash
cd backend
npm ci
func azure functionapp publish func-bingo-api
```

This packages your backend code and uploads it to Azure. It takes about a minute. When done, you will see output listing all the deployed function endpoints.

### 7d. Verify the API is running

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
  --location eastus2 \
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

### 8c. Create the SPA fallback config

Create a file at `frontend/public/staticwebapp.config.json` so that page refreshes don't return 404 (Vite copies everything in `public/` into `dist/` on every build):

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

If you already built before adding this file, rebuild or manually copy it into `frontend/dist/`.

### 8d. Deploy with the SWA CLI

```bash
# Install the Static Web Apps CLI globally
npm install -g @azure/static-web-apps-cli

# Get the deployment token
SWA_TOKEN=$(az staticwebapp secrets list \
  --name swa-bingo \
  --resource-group rg-bingo \
  --query 'properties.apiKey' -o tsv)

# Deploy the built frontend
swa deploy frontend/dist --deployment-token "$SWA_TOKEN"
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
```

> Replace `<your-swa-name>.azurestaticapps.net` with the actual URL from Step 8e.

---

## Step 10 — Verify everything works

Open your Static Web App URL in a browser and check:

| # | What to check | Expected result |
|---|---|---|
| 1 | App loads | You see the **Game**, **Keywords**, **Submit**, and **Help** tabs |
| 2 | Start a game | Enter a name, pick a pack (e.g. `42`), the 3×3 board appears |
| 3 | Quick Pick | Generates a random pack between 1–999 |
| 4 | Page reload | Board, cleared tiles, and keywords are restored |
| 5 | Submit keyword | The submission goes through (check browser DevTools Network tab — you should see a `POST` to `/api/submissions`) |
| 6 | Leaderboard | Visit the Submit tab — leaderboard shows your submission |
| 7 | No console errors | Browser DevTools → Console shows no errors |
| 8 | Admin dashboard | `curl -H "X-Admin-Key: <your-key>" https://func-bingo-api.azurewebsites.net/api/admin/dashboard?campaign=APR26` returns engagement data |

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

---

## Cost estimate

For a typical event (hundreds of players over a few days):

| Resource | Tier | Estimated monthly cost |
|---|---|---|
| Azure SQL Database | Basic (5 DTU) | ~$5 |
| Azure Functions | Consumption (pay-per-execution) | Free (1M executions/mo included) |
| Storage Account | Standard LRS | < $0.10 |
| Azure Static Web Apps | Free | $0 |
| **Total** | | **~$5/month** |

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

This deletes the SQL server, database, function app, storage account, and static web app — everything created in this guide. The `--no-wait` flag returns immediately; deletion happens in the background and takes a few minutes.

---

## Quick reference — All resource names

| Resource | Default name | Customizable? |
|---|---|---|
| Resource Group | `rg-bingo` | Yes |
| SQL Server | `sql-bingo-server` | Yes (globally unique) |
| SQL Database | `bingodb` | Yes |
| Storage Account | `stbingofunc` | Yes (globally unique, lowercase, no hyphens) |
| Function App | `func-bingo-api` | Yes (globally unique) |
| Static Web App | `swa-bingo` | Yes |

If you change any name, update it consistently in all subsequent commands.
