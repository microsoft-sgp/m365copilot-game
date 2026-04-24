## 1. Database Schema Migration

- [x] 1.1 Create `campaigns` table and seed with APR26 default record
- [x] 1.2 Create `admin_otps` table for OTP code storage
- [x] 1.3 Add `board_state NVARCHAR(MAX) NULL` column to `game_sessions` table
- [x] 1.4 Add FK constraints from `game_sessions.campaign_id` and `submissions.campaign_id` to `campaigns.id`
- [x] 1.5 Write migration script `003-add-admin-and-campaigns.sql` combining all schema changes

## 2. Backend Admin Auth

- [x] 2.1 Add `jsonwebtoken` dependency to backend `package.json`
- [x] 2.2 Create `adminAuth.js` helper: update `verifyAdminKey` to accept JWT `Authorization: Bearer` header as alternative to `x-admin-key`, using `JWT_SECRET` env var
- [x] 2.3 Create `POST /api/admin/request-otp` Azure Function: validate email against `ADMIN_EMAILS` allow-list, generate 6-digit code, hash with SHA-256, store in `admin_otps` with 10min expiry, send email via configured email service, rate-limit to 1 per 60s per email
- [x] 2.4 Create `POST /api/admin/verify-otp` Azure Function: validate code against stored hash, mark as used, return signed JWT with 4hr expiry
- [x] 2.5 Write unit tests for admin OTP request, verification, JWT generation, and rate limiting

## 3. Backend Public Config Endpoints

- [x] 3.1 Create `GET /api/campaigns/active` Azure Function: return active campaign config from `campaigns` table
- [x] 3.2 Create `GET /api/organizations/domains` Azure Function: return domain-to-org mapping from `org_domains` joined with `organizations`
- [x] 3.3 Write unit tests for both public config endpoints

## 4. Backend Player State Endpoint

- [x] 4.1 Create `GET /api/player/state` Azure Function: accept `email` query param, return player's most recent active session with full `board_state` JSON
- [x] 4.2 Modify `POST /api/sessions` (`createSession.js`): accept `email` in request body, upsert player by email (with sessionId fallback for backward compat)
- [x] 4.3 Modify `PATCH /api/sessions/:id` (`updateSession.js`): accept `boardState` in request body, store as JSON in `board_state` column
- [x] 4.4 Write unit tests for player state retrieval, session creation with email, and board state persistence

## 5. Backend Admin Management Endpoints

- [x] 5.1 Create `GET /api/admin/organizations` Azure Function: list orgs with domain mappings
- [x] 5.2 Create `POST /api/admin/organizations` Azure Function: create org
- [x] 5.3 Create `PUT /api/admin/organizations/:id` Azure Function: update org name
- [x] 5.4 Create `DELETE /api/admin/organizations/:id` Azure Function: delete org (reject if has submissions)
- [x] 5.5 Create `POST /api/admin/organizations/:id/domains` Azure Function: add domain mapping
- [x] 5.6 Create `DELETE /api/admin/organizations/:id/domains/:domainId` Azure Function: remove domain mapping
- [x] 5.7 Write unit tests for organization CRUD and domain management endpoints

## 6. Backend Admin Campaign & Data Endpoints

- [x] 6.1 Create `GET /api/admin/campaigns` Azure Function: list all campaigns with stats
- [x] 6.2 Create `POST /api/admin/campaigns` Azure Function: create campaign
- [x] 6.3 Create `PUT /api/admin/campaigns/:id/settings` Azure Function: update campaign settings (deactivate others when setting active)
- [x] 6.4 Create `GET /api/admin/players` Azure Function: search players by email/name
- [x] 6.5 Create `GET /api/admin/players/:id` Azure Function: player detail with sessions and submissions
- [x] 6.6 Create `DELETE /api/admin/players/:id` Azure Function: delete player with cascade
- [x] 6.7 Create `DELETE /api/admin/submissions/:id` Azure Function: revoke keyword submission
- [x] 6.8 Create `POST /api/admin/campaigns/:id/clear` Azure Function: delete sessions, events, submissions for campaign
- [x] 6.9 Create `POST /api/admin/campaigns/:id/reset-leaderboard` Azure Function: delete submissions for campaign
- [x] 6.10 Write unit tests for campaign management, player management, and data operations endpoints

## 7. Frontend Email Gate & State Sync

- [x] 7.1 Create `EmailGate.vue` component: email input, validation, "Continue" button, "Admin Login" link
- [x] 7.2 Add email to localStorage storage keys in `constants.js` and `storage.js`
- [x] 7.3 Add `apiGetPlayerState(email)` function to `api.js`
- [x] 7.4 Add `apiGetCampaignConfig()` and `apiGetOrgDomains()` functions to `api.js`
- [x] 7.5 Modify `useBingoGame.js`: accept email in `startBoard`, include email in `apiCreateSession` call, send `boardState` in `apiUpdateSession` call, add `hydrateFromServer(serverState)` function
- [x] 7.6 Modify `App.vue`: show `EmailGate` when no email stored, fetch player state on email submit, hydrate game state from server response, fetch campaign config and org map from API with hardcoded fallbacks
- [x] 7.7 Modify `useSubmissions.js` / `SubmitPanel.vue`: use API-fetched org map instead of hardcoded `ORG_MAP` import
- [x] 7.8 Write unit tests for EmailGate component, state hydration, and API config fetching

## 8. Frontend Bug Fixes (Duplicate Keywords & Leaderboard)

- [x] 8.1 Add `verifying` ref to `TileModal.vue`: disable verify button during verification, show loading state
- [x] 8.2 Modify `TileModal.vue` win handling: consolidate multiple line wins into a single toast/modal showing total lines and keywords earned
- [x] 8.3 Modify `LeaderboardTable.vue`: wrap table in `overflow-x-auto` container
- [x] 8.4 Modify `LeaderboardTable.vue`: use short date format for timestamps on viewports < 640px
- [x] 8.5 Modify `LeaderboardTable.vue`: change header text from `text-muted` to `text-lilac`, increase row border opacity from 0.08 to 0.15
- [x] 8.6 Write unit tests for verify button debounce, consolidated win feedback, and leaderboard responsive behavior

## 9. Frontend Admin Portal

- [x] 9.1 Create `AdminLogin.vue` component: email input, OTP request, OTP verification, JWT storage in sessionStorage
- [x] 9.2 Create `AdminLayout.vue` component: sidebar/tab navigation (Dashboard, Organizations, Campaigns, Players, Danger Zone), header with admin email and logout button
- [x] 9.3 Create `AdminDashboard.vue` component: fetch and display stats, sessions table, submissions table, CSV export button
- [x] 9.4 Create `AdminOrganizations.vue` component: list orgs with domains, add/edit/delete orgs, add/remove domain mappings
- [x] 9.5 Create `AdminCampaigns.vue` component: list campaigns, create campaign, edit settings, toggle active
- [x] 9.6 Create `AdminPlayers.vue` component: search by email/name, player detail view, revoke keywords, delete player
- [x] 9.7 Create `AdminDangerZone.vue` component: clear campaign data, reset leaderboard (with confirmation phrases)
- [x] 9.8 Add admin API functions to `api.js`: requestOtp, verifyOtp, admin CRUD for orgs/campaigns/players/submissions/data-ops
- [x] 9.9 Modify `App.vue`: add hash-based routing for `#/admin/*` paths, lazy-load admin views
- [x] 9.10 Remove admin "Clear Local Data" section from `SubmitPanel.vue`
- [x] 9.11 Write unit tests for AdminLogin, AdminDashboard, and key admin views

## 10. Integration & Cleanup

- [x] 10.1 Update `DEPLOYMENT.md` with new environment variables (`ADMIN_EMAILS`, `JWT_SECRET`, `SMTP_CONNECTION`)
- [x] 10.2 Verify all existing backend tests still pass with modified endpoints
- [x] 10.3 Verify all existing frontend tests still pass with modified components
- [x] 10.4 Manual smoke test: email gate → board setup → play → submit keyword → admin login → dashboard → org management → clear data
