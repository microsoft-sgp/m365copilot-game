## Context

The Copilot Chat Bingo game is a Vue 3 + Tailwind CSS frontend backed by Azure Functions and Azure SQL. Players generate a 3×3 bingo board from a deterministic pack number, complete Copilot Chat tasks, earn keywords for completing lines, and submit keywords to a shared leaderboard.

Currently:
- **Player identity** is a random `sessionId` generated client-side (`genId(16)`). All progress lives in `localStorage`. The backend receives fire-and-forget events but cannot serve state back to the player. Switching devices loses all progress.
- **Admin access** uses a static `ADMIN_KEY` environment variable compared via `x-admin-key` header. There is no admin UI — only raw API endpoints. A "Clear Local Data" section is visible to all users in `SubmitPanel.vue`, protected only by a hardcoded passphrase (`RESET-BINGO`).
- **Organization config** is hardcoded in three places: `frontend/src/data/orgMap.js`, `database/002-seed-organizations.sql`, and the `org_domains` DB table. Adding an org requires editing all three.
- **Campaign config** (`CAMPAIGN_ID`, `TOTAL_PACKS`, `TOTAL_WEEKS`, `COPILOT_URL`) is hardcoded in `frontend/src/data/constants.js`.
- **Leaderboard table** has no mobile-responsive handling — four fixed columns overflow on narrow viewports, and table text uses low-contrast colors against the glass background.

## Goals / Non-Goals

**Goals:**
- Players identify by email on first load and can resume progress on any device
- Admin portal with OTP-based authentication for managing the game
- Server-driven configuration for organizations and campaigns (no more hardcoded sync)
- Fix duplicate keyword UX confusion and verify-button double-click race
- Fix leaderboard mobile overflow and contrast issues
- Remove admin controls from the player-facing UI

**Non-Goals:**
- Password-based user accounts or OAuth/SSO for players (email is a lightweight lookup key, not a secure auth system)
- Server-side task bank management (tasks remain in `taskBank.js` for this change — DB-driven tasks are a future phase)
- Real-time collaboration or live board sync between devices (pull-on-load is sufficient)
- Pagination or date-range filtering on admin dashboard (the existing top-100 query is adequate for event-scale usage)

## Decisions

### Decision 1: Email as player identity (no password, no OTP for players)

Players enter their email on first load. The server looks up existing progress and returns it. No password, no verification code.

**Why**: This is a casual game at events, not a banking app. The threat model is someone guessing another player's email to see their bingo progress — very low risk. Adding password or OTP for players would add friction and abandon rate for minimal security benefit.

**Alternative considered**: Magic-link email login — rejected because it requires email infrastructure for all players (not just admins), and the redirect flow is awkward on mobile during a live event.

**Alternative considered**: Session token in URL (shareable link) — rejected because it leaks identity via URL sharing and browser history.

### Decision 2: Admin OTP authentication with JWT sessions

Admin login flow: enter email → receive 6-digit OTP via email → verify OTP → receive JWT stored in `sessionStorage`. JWT expires after 4 hours.

**Why**: OTP is passwordless (no credential management), time-bounded (10-minute expiry on codes), and doesn't require storing password hashes. JWT for sessions avoids server-side session state.

**Alternative considered**: Keep static `ADMIN_KEY` for web UI — rejected because it's a shared secret that can't be revoked per-person and has no audit trail.

**Alternative considered**: Microsoft Entra / Azure AD authentication — rejected as over-engineered for a game admin portal; requires AAD app registration, tenant config, and MSAL integration.

**Backward compatibility**: The existing `x-admin-key` header auth remains as a fallback for CLI/API consumers. Admin endpoints accept either a valid JWT in `Authorization: Bearer <token>` OR a valid `x-admin-key` header.

### Decision 3: Server as source of truth for game state

The server stores full board state (cleared tiles array, won lines, keywords, challenge profile) in the `game_sessions` table. localStorage becomes a write-through cache.

**Flow**:
```
Page load → email entered
  → GET /api/player/state?email=...
  → Server returns { sessions, activeSession: { packId, cleared, wonLines, keywords, ... } }
  → Frontend hydrates Vue reactive state from server response
  → localStorage updated as cache
  → Normal gameplay proceeds (mutations persist to both localStorage AND server)
```

**Why**: The server already receives tile events and session updates. Expanding it to store the full state vector (instead of just summary counters) is incremental. localStorage remains the fast path for in-session persistence; the server is the cross-device bridge.

**Alternative considered**: Sync localStorage between devices via a "sync code" — rejected because it requires another identity mechanism and doesn't solve the "lost device" case.

### Decision 4: Public API endpoints for org map and campaign config

Two new public (unauthenticated) endpoints:
- `GET /api/organizations/domains` → returns `{ "nus.edu.sg": "NUS", ... }`
- `GET /api/campaigns/active` → returns `{ campaignId, totalPacks, totalWeeks, copilotUrl }`

The frontend fetches these on load instead of importing hardcoded files. Hardcoded files remain as fallbacks if the API is unreachable.

**Why**: Eliminates the three-place sync problem for organizations. Enables campaign changes without redeploying the frontend.

### Decision 5: Admin portal as a tab/route within the existing SPA

The admin portal lives in the same Vue app, accessed via a hash route (`#/admin`). An "Admin Login" button on the email gate screen navigates to `#/admin/login`.

**Why**: Avoids a separate deployment, shares the design system, and keeps the single Static Web App deployment. The admin views are lazy-loaded to avoid bloating the player bundle.

**Alternative considered**: Separate admin app (e.g., `admin.example.com`) — rejected because it doubles deployment complexity for a small number of views.

### Decision 6: Verify button debounce + multi-line toast consolidation

For the duplicate keyword issue:
- Add a `verifying` ref that disables the verify button during `verifyTile()` execution
- When a single tile completes multiple lines, show a consolidated toast ("2 lines completed! 2 keywords earned") instead of separate toasts per line

**Why**: The existing dedup guards in `useBingoGame.js` are correct for the single-threaded case. The double-click race and confusing multi-toast UX are the most likely causes of the reported "duplicates."

### Decision 7: Leaderboard mobile fix approach

- Wrap the table in `overflow-x-auto` for horizontal scroll on narrow viewports
- Shorten timestamp format: use `toLocaleDateString()` instead of `toLocaleString()` on screens < 640px
- Increase header text contrast: use `text-lilac` instead of `text-muted` for table headers
- Increase border opacity from `0.08` to `0.15` for row dividers

**Why**: Minimal CSS-only changes that fix the immediate problem without restructuring the table component.

## Risks / Trade-offs

- **[Email as identity is not secure]** → Acceptable for a casual game. Document clearly in help text that email is for convenience, not security. A malicious user can view (but not modify) another player's progress if they know the email. Mitigation: the state retrieval endpoint returns progress data only (no PII beyond what the email itself reveals).

- **[OTP email delivery reliability]** → If OTP emails don't arrive, admins are locked out. Mitigation: keep the `x-admin-key` header as a fallback. Log OTP generation for debugging. Consider adding an OTP to the Azure Functions log output in non-production environments.

- **[game_sessions schema expansion is a breaking migration]** → Adding columns to `game_sessions` for full state (JSON blob or individual columns). Mitigation: use nullable columns with defaults so existing rows are unaffected. New columns: `board_state NVARCHAR(MAX) NULL` as a JSON blob containing `{ cleared, wonLines, keywords, challengeProfile }`.

- **[Frontend loading depends on API for config]** → If the API is down, the frontend can't get org map or campaign config. Mitigation: bundle current values as fallback defaults in the code; only override if API responds. Show a subtle "offline mode" indicator.

- **[Campaign table migration]** → Existing data uses hardcoded `'APR26'` campaign ID as a string FK in `game_sessions` and `submissions`. The new `campaigns` table must be seeded with the `APR26` row before adding FK constraints. Mitigation: migration script inserts the default campaign row first, then adds FK constraints.

## Migration Plan

1. **Database migration** (run before deploying code):
   - Add `campaigns` table with `APR26` seed row
   - Add `admin_otps` table
   - Add `board_state` column to `game_sessions` (nullable, no default)
   - Add FK from `game_sessions.campaign_id` → `campaigns.id` (after seeding)
   - Add FK from `submissions.campaign_id` → `campaigns.id` (after seeding)

2. **Backend deployment**:
   - Deploy new Azure Functions endpoints
   - Set new environment variables: `ADMIN_EMAILS`, `JWT_SECRET`, `SMTP_CONNECTION`
   - Existing endpoints remain backward compatible

3. **Frontend deployment**:
   - Deploy updated SPA with email gate, admin portal, and UI fixes
   - Players with existing localStorage state continue normally — email gate appears on next fresh load

4. **Rollback**:
   - Frontend: revert SPA deployment; players fall back to localStorage-only mode
   - Backend: new endpoints become 404s; existing endpoints unaffected
   - Database: new tables and columns can remain (they're additive and unused if rolled back)

## Open Questions

- Which email service for OTP delivery? Azure Communication Services vs. SendGrid vs. direct SMTP. Decision needed before implementing `admin-auth`.
- Should the `board_state` column be a single JSON blob or individual columns for `cleared`, `won_lines`, `keywords`, `challenge_profile`? JSON blob is simpler; individual columns enable SQL queries on specific fields. Leaning toward JSON blob for simplicity.
