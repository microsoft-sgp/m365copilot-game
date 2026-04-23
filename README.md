# Copilot Chat Bingo

A browser-based Bingo game for Microsoft 365 Copilot Chat events. Players generate a deterministic 3×3 board from a pack number, complete Copilot tasks, submit proofs, earn keywords for each completed line, and submit those keywords to a shared leaderboard.

## Features

- **Deterministic boards** — pack numbers `1`–`999` always generate the same nine tasks in the same order, so facilitators can reuse known packs.
- **Quick pick** — one-click random pack selection within the supported range.
- **Proof submission & verification** — per-tile validation rules check the player's submitted proof before clearing the tile.
- **Line detection & keyword minting** — completing a row, column, or diagonal awards a unique keyword, exactly once per line.
- **Weekly challenges** — bonus progression tracked alongside the main board.
- **Shared leaderboard** — keyword submissions are stored in Azure SQL and ranked per-organization across all players.
- **Admin dashboard** — protected endpoint for event facilitators to view engagement metrics and export CSV data.
- **Session continuity** — reloading the page restores the active board, cleared tiles, earned keywords, and challenge progress from `localStorage`.
- **Responsive UI** — Tailwind CSS v4 layout that remains usable on narrow viewports.

## Architecture

```
┌─────────────┐      HTTPS       ┌───────────────────┐       SQL        ┌──────────────┐
│   Frontend   │  ─────────────► │  Azure Functions   │ ──────────────► │  Azure SQL   │
│  (Vue 3 SPA) │   /api/*        │  (Node.js v4 API)  │                 │  Database     │
└─────────────┘                  └───────────────────┘                  └──────────────┘
   Static Web App                   Function App                          Basic tier
   or any static host               Consumption plan
```

## Project layout

| Path | Description |
| --- | --- |
| [frontend/](frontend/) | Vue 3 + Tailwind CSS v4 single-page application. |
| [backend/](backend/) | Azure Functions v4 (Node.js) API — sessions, events, submissions, leaderboard, admin. |
| [database/](database/) | Azure SQL migration scripts (schema + seed data). |
| [index.html](index.html) | Legacy single-file build, kept as a rollback target. |
| [openspec/](openspec/) | Spec-driven change history. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | **Step-by-step Azure deployment guide.** |

### Frontend source

| Path | Description |
| --- | --- |
| [frontend/src/App.vue](frontend/src/App.vue) | Root shell with tabs for Game, Keywords, Submit, Help. |
| [frontend/src/components/](frontend/src/components/) | UI components (board, panels, modals, HUD). |
| [frontend/src/composables/](frontend/src/composables/) | Reactive game state, submissions, and toast helpers. |
| [frontend/src/lib/](frontend/src/lib/) | Pure logic: deterministic RNG, pack generation, verification, keyword minting, API client, storage adapters. |
| [frontend/src/data/](frontend/src/data/) | Static data: task bank, line definitions, organization map, storage key constants. |

### Backend source

| Path | Description |
| --- | --- |
| [backend/src/functions/](backend/src/functions/) | HTTP-triggered Azure Functions (one file per endpoint). |
| [backend/src/lib/](backend/src/lib/) | Shared helpers — SQL connection pool, input validation, admin auth. |
| [backend/host.json](backend/host.json) | Azure Functions host configuration (route prefix, logging). |

## Prerequisites

- **Node.js** 20.x or later
- **npm** 10.x (bundled with Node 20)
- A modern evergreen browser (Chromium, Firefox, or Safari)

For deployment you also need:

- **Azure CLI** (`az`) — [install guide](https://learn.microsoft.com/cli/azure/install-azure-cli)
- **Azure Functions Core Tools** v4 (`func`) — [install guide](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
- An **Azure subscription** (a free account works)

## Quick start (local development)

```bash
# Terminal 1 — start the API
cd backend
npm install
# Edit local.settings.json with your SQL connection string and ADMIN_KEY
func start

# Terminal 2 — start the frontend (dev server proxies /api to localhost:7071)
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), enter a player name, pick a pack number (or use Quick Pick), and start the board.

## Deploy to Azure

See [DEPLOYMENT.md](DEPLOYMENT.md) for a complete step-by-step guide covering:

1. Creating an Azure SQL Database and running migrations
2. Deploying the Azure Functions API
3. Deploying the frontend to Azure Static Web Apps
4. Configuring CORS, environment variables, and custom domains
5. Post-deploy verification and troubleshooting

## API endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Create player + game session |
| `PATCH` | `/api/sessions/{id}` | Update session progress |
| `POST` | `/api/events` | Record tile events |
| `POST` | `/api/submissions` | Submit keyword for leaderboard |
| `GET` | `/api/leaderboard` | Aggregated org rankings |
| `GET` | `/api/admin/dashboard` | Admin metrics (requires `X-Admin-Key`) |
| `GET` | `/api/admin/export` | CSV export (requires `X-Admin-Key`) |

## Data & persistence

- **Server-side**: game sessions, tile events, and keyword submissions are stored in Azure SQL. The leaderboard is shared across all players.
- **Client-side**: active board state (cleared tiles, earned keywords, challenge progress) and player profile are stored in the browser's `localStorage`.

## Specs & change history

This repository uses OpenSpec for spec-driven development.

- Current spec: [openspec/specs/bingo-frontend/spec.md](openspec/specs/bingo-frontend/spec.md)
- Archived changes: [openspec/changes/archive/](openspec/changes/archive/)

When proposing a behavior change, add a new entry under `openspec/changes/` with a proposal, design, tasks, and a delta spec. After implementation, archive the change and sync the main spec.

## License

See [LICENSE](LICENSE).
