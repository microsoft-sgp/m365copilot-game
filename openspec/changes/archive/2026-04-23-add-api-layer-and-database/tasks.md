## 1. Database Setup

- [x] 1.1 Create `database/` folder and `001-create-tables.sql` with full schema: organizations, org_domains, players, game_sessions, tile_events, submissions tables with constraints and indexes
- [x] 1.2 Create `database/002-seed-organizations.sql` to seed all organizations and domain mappings from orgMap.js (including MOE's two domains)

## 2. Backend Project Scaffold

- [x] 2.1 Create `backend/` folder with `package.json` (dependencies: `@azure/functions`, `mssql`), `host.json`, and `.gitignore` for `local.settings.json`
- [x] 2.2 Create `backend/local.settings.json` template with `SQL_CONNECTION_STRING` and `ADMIN_KEY` placeholders
- [x] 2.3 Create shared database connection helper in `backend/src/lib/db.js` using `mssql` connection pool

## 3. Core API Endpoints

- [x] 3.1 Implement `POST /api/sessions` — upsert player by sessionId, create game_sessions record, return gameSessionId
- [x] 3.2 Implement `PATCH /api/sessions/:id` — update tilesCleared, linesWon, keywordsEarned, and last_active_at
- [x] 3.3 Implement `POST /api/events` — insert tile_events record with gameSessionId, tileIndex, eventType, optional keyword and lineId
- [x] 3.4 Implement `POST /api/submissions` — validate keyword format, resolve org from email domain via org_domains lookup, upsert player, insert submission (handle unique constraint violation), detect orgDupe, return result
- [x] 3.5 Implement `GET /api/leaderboard` — aggregation query joining submissions and organizations, COUNT(DISTINCT keyword) as score, COUNT(DISTINCT email) as contributors, filtered by campaign_id query param
- [x] 3.6 Port `validateKeywordFormat` from `frontend/src/lib/verification.js` to `backend/src/lib/validation.js` for server-side keyword validation

## 4. Admin Endpoints

- [x] 4.1 Create admin auth middleware that checks `X-Admin-Key` header against `ADMIN_KEY` env var with constant-time comparison; returns 401 on mismatch, 500 if not configured
- [x] 4.2 Implement `GET /api/admin/dashboard` — return sessions, submissions, and summary stats (totalPlayers, totalSessions, totalSubmissions, avgTilesCleared, topOrg)
- [x] 4.3 Implement `GET /api/admin/export` — return CSV of submissions with headers org, player_name, email, keyword, submitted_at; set Content-Type and Content-Disposition headers

## 5. Frontend API Client

- [x] 5.1 Create `frontend/src/lib/api.js` — thin fetch wrapper with base URL config, JSON parsing, and error handling that returns failure results instead of throwing

## 6. Frontend Composable Updates

- [x] 6.1 Update `useSubmissions.js` — switch `submit()` to call `POST /api/submissions` with localStorage as fallback on failure; add `refreshLeaderboard()` that fetches from `GET /api/leaderboard`
- [x] 6.2 Add 30-second leaderboard polling — start polling on mount when leaderboard is visible, stop on unmount; immediate refresh after successful submission
- [x] 6.3 Update `useBingoGame.js` — add fire-and-forget `POST /api/sessions` call in `startBoard()`; store returned gameSessionId in state
- [x] 6.4 Update `useBingoGame.js` — add fire-and-forget `POST /api/events` call in `verifyTile()` for tile clears, line wins, and keyword earnings

## 7. CORS and Deployment Configuration

- [x] 7.1 Configure CORS in `backend/host.json` to allow requests from the App Service origin
- [x] 7.2 Update `DEPLOYMENT.md` with Azure SQL provisioning steps, Function App deployment, App Settings configuration (SQL_CONNECTION_STRING, ADMIN_KEY), and CORS setup
