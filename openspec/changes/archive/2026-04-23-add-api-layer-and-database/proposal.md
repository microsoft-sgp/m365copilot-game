## Why

The Bingo game currently stores all participant data — game state, keyword submissions, and leaderboard rankings — in browser localStorage. This means every player sees only their own submissions, the leaderboard is a personal scoreboard rather than a shared one, and all data is lost if the browser cache is cleared. For a campaign game with hundreds of participants across multiple organizations, there is no way to track engagement, produce reports, or display a real shared leaderboard. Adding a server-side API layer with Azure SQL persistence solves all of these problems.

## What Changes

- **New `backend/` Azure Functions project** (Node.js v4) providing a RESTful API with five core endpoints: session creation, session updates, event recording, keyword submission, and leaderboard retrieval.
- **New `database/` folder** with SQL migration scripts to create and seed the Azure SQL schema — tables for organizations, org-domain mappings, players, game sessions, tile events, and submissions.
- **New admin endpoint and view** behind a static password for querying game sessions and submissions, plus a CSV export endpoint for campaign reporting.
- **Real-time leaderboard polling** — frontend polls `GET /api/leaderboard` every 30 seconds so all players see a shared, up-to-date leaderboard.
- **Frontend composable changes** — `useSubmissions` switches from localStorage-only to server-backed fetch calls (keeping localStorage as an offline cache). `useBingoGame` gains fire-and-forget API calls to record sessions and tile events for engagement analytics.
- **New `frontend/src/lib/api.js`** — thin fetch wrapper for all backend communication.
- **Server-side input validation and abuse protection** — keyword format validation, parameterized SQL queries, and rate limiting on submission endpoints.

## Capabilities

### New Capabilities
- `game-api`: Azure Functions backend providing RESTful endpoints for session management, event tracking, keyword submission, and leaderboard retrieval.
- `game-database`: Azure SQL schema design covering organizations, players, game sessions, tile events, and submissions, with migration and seed scripts.
- `admin-dashboard`: Read-only admin view behind a static password for querying game sessions, submissions, and CSV export for campaign reporting.

### Modified Capabilities
- `bingo-frontend`: Submissions and leaderboard switch from localStorage-only to server-backed with localStorage as a fallback cache. Game session start and tile clears emit fire-and-forget events to the backend. Leaderboard polls every 30 seconds.

## Impact

- **New infrastructure**: Azure Functions App, Azure SQL Database — requires provisioning and connection string configuration.
- **Frontend code**: `useSubmissions.js` and `useBingoGame.js` composables gain async API calls. New `api.js` utility module. New admin UI component.
- **Dependencies**: `backend/package.json` will add `@azure/functions`, `mssql` (or `tedious`). Frontend gains no new npm dependencies (uses native `fetch`).
- **Deployment**: Changes from a pure static SPA to a two-part deployment (App Service for SPA + Azure Functions for API). `DEPLOYMENT.md` must be updated.
- **CORS**: Azure Functions must be configured to accept requests from the App Service origin.
- **Rollback plan**: Frontend retains localStorage as a fallback. If the API is unavailable, game play continues uninterrupted — only the shared leaderboard degrades to local-only mode. Database can be torn down independently. Functions can be disabled without affecting the static SPA.
- **Affected teams**: Game organizers (need Azure subscription access for provisioning), campaign administrators (new admin dashboard to learn).
