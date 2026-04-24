## Why

The game has four bugs impacting usability, security, and mobile experience: (1) player progress is trapped in browser localStorage with no way to resume on another device, (2) completing a bingo line may award duplicate keyword notifications confusing players, (3) the admin "Clear Data" control is visible and accessible to all users, and (4) the leaderboard table overflows on mobile screens with poor color contrast. Additionally, the project lacks a proper admin portal — admin operations require direct API calls with a static key, and game configuration (organizations, domains, campaign settings) is hardcoded across multiple files that must be manually kept in sync.

## What Changes

- Add an email gate on first load so players identify themselves before playing; use email as the primary identity anchor for cross-device state sync
- Add a server-side endpoint to retrieve and hydrate player game state by email, making the database the source of truth instead of localStorage
- Add verify-button debounce in TileModal to prevent double-click race conditions, and improve multi-line-win UX feedback to clarify that multiple keywords from one tile are intentional
- Build a full admin portal with Email + OTP authentication, replacing the static `x-admin-key` header for web-based admin access
- Create admin frontend views: dashboard (consuming existing API), organization/domain CRUD, campaign settings, player lookup, and a danger-zone for data operations
- Move the "Clear Data" control from SubmitPanel into the authenticated admin portal as a server-side operation
- Replace hardcoded `orgMap.js` with a public API endpoint serving organization-domain mappings from the database
- Replace hardcoded campaign constants (`CAMPAIGN_ID`, `TOTAL_PACKS`, `TOTAL_WEEKS`, `COPILOT_URL`) with a public API endpoint serving active campaign configuration
- Fix leaderboard table mobile overflow with horizontal scroll and responsive timestamp formatting
- Improve leaderboard table color contrast for headers and borders on mobile

## Capabilities

### New Capabilities
- `player-identity`: Email-based player identification on first load, cross-device state retrieval, and server-side state hydration
- `admin-auth`: Email + OTP authentication flow for admin access with JWT session tokens, admin email allow-list, and rate limiting
- `admin-portal`: Admin frontend views for dashboard, organization/domain management, campaign settings, player lookup, keyword revocation, and data operations
- `campaign-config`: Server-driven campaign configuration replacing hardcoded frontend constants, with admin CRUD for campaign settings
- `org-management`: Admin CRUD for organizations and email-domain mappings, plus a public API endpoint replacing the hardcoded orgMap

### Modified Capabilities
- `bingo-frontend`: Add email gate before board setup, debounce verify button, improve multi-line-win feedback, fix leaderboard mobile overflow and contrast, remove admin clear-data section from SubmitPanel, add admin login button to landing page, fetch org map and campaign config from API instead of hardcoded files
- `game-api`: Modify session creation to accept email, add player state retrieval endpoint, add public endpoints for org-domain map and campaign config
- `game-database`: Add `admin_otps` table, add `campaigns` table, make `players.email` the primary identity anchor, expand `game_sessions` to store full board state for cross-device sync
- `admin-dashboard`: Replace static `x-admin-key` auth with JWT-based auth (keeping `x-admin-key` as backward-compatible fallback), add organization CRUD endpoints, campaign management endpoints, player management endpoints, and data operation endpoints

## Impact

- **Frontend**: New components (EmailGate, AdminLogin, AdminLayout, AdminDashboard, AdminOrganizations, AdminCampaigns, AdminPlayers, AdminDangerZone), modified components (SubmitPanel, SetupPanel, App, GameTab), replaced static data files (orgMap.js constants from constants.js served by API)
- **Backend**: ~12 new API endpoints across admin auth, org management, campaign management, player management, and data operations; modified existing session/submission endpoints to use email-based identity
- **Database**: 2 new tables (admin_otps, campaigns), schema changes to players and game_sessions tables; migration script required
- **Environment variables**: New `ADMIN_EMAILS`, `JWT_SECRET`, `SMTP_CONNECTION` (or `ACS_CONNECTION` for Azure Communication Services)
- **Breaking changes**: None for players — existing localStorage state continues to work; email gate is additive. Admin API consumers using `x-admin-key` header are unaffected (backward compatible)
- **Rollback plan**: Feature-flag the email gate (fall back to anonymous localStorage-only mode). Admin portal is additive — removing it leaves the game functional. Database migrations are forward-only but non-destructive (new tables + nullable column additions)
- **Affected teams**: Frontend (Vue components), backend (Azure Functions), database (schema migration), DevOps (new environment variables and email service configuration)
