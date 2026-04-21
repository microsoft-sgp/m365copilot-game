# Deployment Guide

This guide covers building the Copilot Chat Bingo frontend and deploying it to a static host. The app is fully client-side, so any static file host with HTTPS will work.

## Contents

- [Build the production bundle](#build-the-production-bundle)
- [What to deploy](#what-to-deploy)
- [Option 1 — GitHub Pages](#option-1--github-pages)
- [Option 2 — Azure Static Web Apps](#option-2--azure-static-web-apps)
- [Option 3 — Azure Blob Storage static website](#option-3--azure-blob-storage-static-website)
- [Option 4 — Generic static host (Netlify, Vercel, S3, Nginx)](#option-4--generic-static-host-netlify-vercel-s3-nginx)
- [Post-deploy verification](#post-deploy-verification)
- [Rolling back to the legacy build](#rolling-back-to-the-legacy-build)
- [Troubleshooting](#troubleshooting)

---

## Build the production bundle

Prerequisites: Node.js 20.x and npm 10.x.

```bash
cd frontend
npm ci          # reproducible install from package-lock.json (use `npm install` if no lockfile)
npm run build
```

The compiled site is written to [frontend/dist/](frontend/dist/). Only that directory needs to be deployed.

To smoke-test the production bundle locally before publishing:

```bash
npm run preview
```

### Configuring a non-root base path

If the site will be served from a subpath (e.g. `https://example.com/bingo/`), set Vite's `base` option before building:

```bash
# one-off
npm run build -- --base=/bingo/
```

Or update [frontend/vite.config.js](frontend/vite.config.js):

```js
export default defineConfig({
  base: '/bingo/',
  plugins: [vue(), tailwindcss()],
});
```

Skip this step for root-domain deployments (`base` defaults to `/`).

---

## What to deploy

- Upload everything inside `frontend/dist/` to the host's web root (or chosen subpath).
- Ensure `index.html` is served as the default document.
- Serve over **HTTPS**. The app uses `localStorage`, which browsers partition per-origin; switching protocols or domains will appear to "lose" player progress.
- No server-side runtime, environment variables, or secrets are required.

---

## Option 1 — GitHub Pages

Recommended when the repository already lives on GitHub.

1. Decide the URL. For `https://<user>.github.io/m365copilot-game/`, set `base: '/m365copilot-game/'` in [frontend/vite.config.js](frontend/vite.config.js).
2. Add a workflow at `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy frontend to GitHub Pages

   on:
     push:
       branches: [main]
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   concurrency:
     group: pages
     cancel-in-progress: true

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: npm
             cache-dependency-path: frontend/package-lock.json
         - run: npm ci
           working-directory: frontend
         - run: npm run build
           working-directory: frontend
         - uses: actions/upload-pages-artifact@v3
           with:
             path: frontend/dist

     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Push to `main`. The deployed URL appears in the workflow's `deploy` job output.

---

## Option 2 — Azure Static Web Apps

Recommended for production hosting on Azure with a global CDN, free TLS, and PR preview environments.

### One-time setup

1. Create the resource (Azure CLI shown; portal works equivalently):

   ```bash
   az group create --name rg-bingo --location eastus2
   az staticwebapp create \
     --name swa-bingo \
     --resource-group rg-bingo \
     --location eastus2 \
     --sku Free \
     --source https://github.com/<owner>/m365copilot-game \
     --branch main \
     --app-location "frontend" \
     --output-location "dist" \
     --login-with-github
   ```

   The CLI provisions the resource and commits a workflow file under `.github/workflows/azure-static-web-apps-*.yml`.

2. If you prefer to manage the workflow yourself, set:
   - `app_location: "frontend"`
   - `output_location: "dist"`
   - `api_location: ""` (no backend)

3. Add a SPA fallback so deep links work. Create `frontend/public/staticwebapp.config.json`:

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

   Files in `frontend/public/` are copied verbatim to `dist/` by Vite.

4. Push to `main`. The workflow builds `frontend/` and publishes `frontend/dist/` to the SWA endpoint shown in the Azure portal.

### Custom domain

In the Azure portal: **Custom domains → Add → Custom domain on other DNS** and follow the CNAME / TXT validation steps. TLS is provisioned automatically.

---

## Option 3 — Azure Blob Storage static website

Lower cost than SWA when previews and per-PR environments are not needed.

```bash
# create storage and enable static website hosting
az group create --name rg-bingo --location eastus2
az storage account create \
  --name stbingo$RANDOM \
  --resource-group rg-bingo \
  --location eastus2 \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access true

ACCOUNT=<the-name-you-just-created>
az storage blob service-properties update \
  --account-name "$ACCOUNT" \
  --static-website \
  --index-document index.html \
  --404-document index.html   # SPA fallback

# build and upload
cd frontend
npm ci && npm run build
az storage blob upload-batch \
  --account-name "$ACCOUNT" \
  --source dist \
  --destination '$web' \
  --overwrite
```

Get the public URL with:

```bash
az storage account show \
  --name "$ACCOUNT" \
  --resource-group rg-bingo \
  --query "primaryEndpoints.web" -o tsv
```

For a custom domain and HTTPS, front the storage account with **Azure Front Door** or **Azure CDN**.

---

## Option 4 — Generic static host (Netlify, Vercel, S3, Nginx)

Any static host works. Common settings:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Build directory | `frontend` |
| Publish / output directory | `frontend/dist` |
| Node version | `20` |
| SPA fallback | rewrite all unknown paths to `/index.html` |

### Nginx example

```nginx
server {
  listen 443 ssl http2;
  server_name bingo.example.com;

  root /var/www/bingo;
  index index.html;

  # cache hashed assets aggressively
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # never cache the entry document
  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Copy `frontend/dist/*` to `/var/www/bingo/` after each build.

---

## Post-deploy verification

After publishing, check the following on the live URL:

1. The app shell loads with **Game**, **Keywords**, **Submit**, and **Help** tabs visible.
2. Entering a name and a pack number (e.g. `42`) starts a 3×3 board.
3. **Quick Pick** picks a pack within `1`–`999` and starts a board.
4. Reloading the page restores the active board, cleared tiles, and earned keywords.
5. Submitting a valid keyword updates the local leaderboard; resubmitting the same email + keyword is rejected.
6. Browser DevTools → **Console** shows no errors and no failed network requests other than the initial static assets.
7. Browser DevTools → **Application → Local Storage** shows the keys defined in [frontend/src/data/constants.js](frontend/src/data/constants.js).

---

## Rolling back to the legacy build

The legacy single-file build at [index.html](index.html) is intentionally preserved as a rollback target.

To roll back, deploy only the repo-root `index.html` (and any sibling assets it references) to the same origin. Because the legacy file uses the same `localStorage` keys, existing players' progress remains intact across the rollback.

The legacy file shows a banner pointing back to the migrated frontend so players are not confused if they reach it via an old bookmark.

---

## Troubleshooting

**Blank page after deploy, 404s for `/assets/*.js`**
The build was published under a subpath but `base` is still `/`. Set `base` in [frontend/vite.config.js](frontend/vite.config.js) (or pass `--base=/subpath/` to `npm run build`) and redeploy.

**Deep links return 404**
The host is not configured for SPA fallback. Add the `staticwebapp.config.json` (Azure SWA), `--404-document index.html` (Azure Storage), or `try_files ... /index.html` (Nginx) shown above.

**Player progress disappears after deploy**
`localStorage` is partitioned by origin and protocol. Confirm the site is served from the same scheme + host as before. Switching from `http://` to `https://`, or moving from a `*.azurestaticapps.net` subdomain to a custom domain, will appear as data loss.

**Stale UI after a new release**
The hashed asset filenames change every build, but the entry `index.html` should not be cached. Verify the host returns `Cache-Control: no-cache` (or similar) on `/index.html`. The Azure SWA and Nginx examples above already do this.

**Tailwind classes missing in production**
Confirm `frontend/src/styles/tailwind.css` is imported from `frontend/src/main.js` and that `@tailwindcss/vite` is listed under `devDependencies`. Re-run `npm ci` to ensure a clean install.
