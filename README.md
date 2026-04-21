# Copilot Chat Bingo

A browser-based Bingo game for Microsoft 365 Copilot Chat events. Players generate a deterministic 3×3 board from a pack number, complete Copilot tasks, submit proofs, earn keywords for each completed line, and submit those keywords to a local leaderboard.

The app is fully client-side: there is no backend. All progress, submissions, and leaderboard data are stored in the browser's `localStorage`.

## Features

- **Deterministic boards** — pack numbers `1`–`999` always generate the same nine tasks in the same order, so facilitators can reuse known packs.
- **Quick pick** — one-click random pack selection within the supported range.
- **Proof submission & verification** — per-tile validation rules check the player's submitted proof before clearing the tile.
- **Line detection & keyword minting** — completing a row, column, or diagonal awards a unique keyword, exactly once per line.
- **Weekly challenges** — bonus progression tracked alongside the main board.
- **Local leaderboard** — submissions are validated, deduplicated by email + keyword, and ranked client-side.
- **Session continuity** — reloading the page restores the active board, cleared tiles, earned keywords, challenge progress, and submissions from `localStorage`.
- **Responsive UI** — Tailwind CSS v4 layout that remains usable on narrow viewports.

## Project layout

| Path | Description |
| --- | --- |
| [frontend/](frontend/) | Active Vue 3 + Tailwind CSS v4 application. All new development happens here. |
| [index.html](index.html) | Legacy single-file build, kept as a rollback target. Displays a banner pointing to the migrated frontend. |
| [openspec/](openspec/) | Spec-driven change history. Active spec: [openspec/specs/bingo-frontend/spec.md](openspec/specs/bingo-frontend/spec.md). |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build and hosting guide for production deployments. |

### Frontend source

| Path | Description |
| --- | --- |
| [frontend/src/App.vue](frontend/src/App.vue) | Root shell with tabs for Game, Keywords, Submit, Help. |
| [frontend/src/components/](frontend/src/components/) | UI components (board, panels, modals, HUD). |
| [frontend/src/composables/](frontend/src/composables/) | Reactive game state, submissions, and toast helpers. |
| [frontend/src/lib/](frontend/src/lib/) | Pure logic: deterministic RNG, pack generation, verification, keyword minting, storage adapters. |
| [frontend/src/data/](frontend/src/data/) | Static data: task bank, line definitions, organization map, storage key constants. |
| [frontend/src/styles/tailwind.css](frontend/src/styles/tailwind.css) | Primary Tailwind CSS entry. |

## Prerequisites

- **Node.js** 20.x or later (Vite 6 requires Node 18+; 20 LTS recommended).
- **npm** 10.x (bundled with Node 20).
- A modern evergreen browser for local testing (Chromium, Firefox, or Safari).

## Quick start

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), enter a player name, pick a pack number (or use Quick Pick), and start the board.

## Build for production

```bash
cd frontend
npm install
npm run build    # output: frontend/dist/
npm run preview  # optional: serve the production build locally
```

The contents of `frontend/dist/` are the only files needed for hosting. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting options (GitHub Pages, Azure Static Web Apps, Azure Blob Storage static website, generic static host).

## Data & persistence

All player data lives in the browser under the keys defined in [frontend/src/data/constants.js](frontend/src/data/constants.js):

- Active board state (cleared tiles, earned keywords, challenge progress)
- Player profile (name, last-used pack number)
- Submissions used to render the local leaderboard

There is no telemetry, no analytics, and no network call to a backend. Clearing site data resets the player's progress.

## Legacy fallback

The single-file build at [index.html](index.html) remains available as a rollback target until the migrated frontend is fully validated. It surfaces a banner pointing to the new frontend so users on the legacy URL can find the active app.

## Specs & change history

This repository uses OpenSpec for spec-driven development.

- Current spec: [openspec/specs/bingo-frontend/spec.md](openspec/specs/bingo-frontend/spec.md)
- Archived changes: [openspec/changes/archive/](openspec/changes/archive/)

When proposing a behavior change, add a new entry under `openspec/changes/` with a proposal, design, tasks, and a delta spec. After implementation, archive the change and sync the main spec.

## License

See [LICENSE](LICENSE).
