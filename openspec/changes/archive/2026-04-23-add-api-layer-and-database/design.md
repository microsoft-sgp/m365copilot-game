## Context

The Copilot Chat Bingo game is a Vue 3 SPA that currently runs entirely in the browser. All game state, keyword submissions, and leaderboard data live in localStorage. There is no backend. This design introduces an Azure Functions API layer and Azure SQL database to persist participant data, enable a shared leaderboard, track engagement, and provide admin/export capabilities.

The audience is hundreds of participants across Singapore educational institutions, playing over a 7-week campaign (`APR26`). The game is open/anonymous — no authentication.

Current data flow:
```
Browser localStorage
├── copilot_bingo_state       → sessionId, playerName, packId, tiles, cleared, wonLines, keywords, challengeProfile
├── copilot_bingo_subs        → [{org, name, email, kw, ts, orgDupe}, ...]
├── copilot_bingo_player_name → string
└── copilot_bingo_last_pack   → string
```

## Goals / Non-Goals

**Goals:**
- Persist keyword submissions server-side so all players share one leaderboard
- Track game engagement (sessions started, tiles cleared, lines won) for campaign analytics
- Provide admin dashboard to view participation data and export CSV reports
- Keep the game playable when the API is temporarily unavailable (localStorage fallback)
- Protect against abuse without requiring authentication (validation, rate limiting)

**Non-Goals:**
- User authentication or identity management (game remains open/anonymous)
- Real-time WebSocket/SignalR push updates (polling every 30s is sufficient for hundreds of users)
- Server-side game state management (game logic stays client-side; server records events)
- Multi-region deployment or high-availability architecture
- Redis caching layer (unnecessary at this scale)

## Decisions

### Decision 1: Azure Functions v4 (Node.js) for the API

**Choice**: Azure Functions with the v4 programming model, deployed as a standalone Function App.

**Alternatives considered**:
- *Azure Static Web Apps managed Functions*: Simpler deployment (co-located with SPA), but limited control over scaling, SKU, and runtime configuration. Can't configure VNet or custom domains as flexibly.
- *Express/Hono on App Service*: Full control, but heavier operational overhead for 5 endpoints serving hundreds of users.

**Rationale**: Standalone Functions provide the right balance — serverless scaling, pay-per-execution cost model ideal for a time-bounded campaign, and full control over configuration. The v4 model uses standard Node.js patterns (ESM, async/await) that align with the frontend codebase.

### Decision 2: Azure SQL Database for persistence

**Choice**: Azure SQL Database (Basic or S0 tier).

**Rationale**: The data is relational (organizations → submissions, players → sessions → events). Azure SQL provides ACID transactions for deduplication constraints, familiar SQL for reporting/admin queries, and the Basic tier is cost-effective for hundreds of users. Cosmos DB was considered but adds complexity for data that is naturally relational and low-volume.

### Decision 3: Connection string authentication

**Choice**: SQL auth via connection string stored in Function App Settings.

**Alternatives considered**:
- *Managed Identity*: More secure (no secrets), but adds setup complexity (AAD admin, identity grants) for a time-bounded campaign game.

**Rationale**: For a campaign lasting 7 weeks with no sensitive PII beyond email addresses, a connection string in App Settings (not in code, not in source control) is an acceptable trade-off of security vs. simplicity.

### Decision 4: Folder structure — `backend/` and `database/`

**Choice**: API code in `backend/`, SQL scripts in `database/`.

```
m365copilot-game/
├── frontend/              ← existing Vue SPA
├── backend/               ← NEW: Azure Functions project
│   ├── package.json
│   ├── host.json
│   ├── local.settings.json (.gitignored)
│   └── src/
│       └── functions/
│           ├── createSession.js
│           ├── updateSession.js
│           ├── recordEvent.js
│           ├── submitKeyword.js
│           ├── getLeaderboard.js
│           ├── adminDashboard.js
│           └── exportCsv.js
├── database/              ← NEW: SQL migration scripts
│   ├── 001-create-tables.sql
│   └── 002-seed-organizations.sql
└── DEPLOYMENT.md
```

### Decision 5: Normalized schema with org_domains table

**Choice**: Separate `org_domains` table mapping email domains to organizations (many-to-one), rather than a domain column on `organizations`.

**Rationale**: The existing `orgMap.js` maps two domains (`schools.gov.sg`, `students.edu.sg`) to the same org (`MOE`). A separate mapping table handles this cleanly and allows adding new domain mappings without schema changes.

### Decision 6: Fire-and-forget event tracking

**Choice**: Game event recording (`POST /api/events`) is fire-and-forget from the client. Failures don't block gameplay.

**Rationale**: Engagement data is valuable for analytics but not critical to the player experience. If an event POST fails (network issue, cold start timeout), the game continues normally. The submission endpoint (`POST /api/submissions`) is the only call where failure matters to the user.

### Decision 7: Leaderboard polling at 30-second intervals

**Choice**: Frontend polls `GET /api/leaderboard` every 30 seconds when the leaderboard tab is visible.

**Alternatives considered**:
- *SignalR/WebSocket*: Real-time push, but adds infrastructure complexity and a persistent connection model that's overkill for hundreds of users.
- *Poll on every page load only*: Simpler, but leaderboard feels stale during active play sessions.

**Rationale**: 30-second polling is simple, stateless, and produces negligible load at this scale (~0.5 req/s peak across all users).

### Decision 8: Admin dashboard with static password

**Choice**: Admin endpoints protected by a static password sent as a header (`X-Admin-Key`), verified against a Function App Setting.

**Rationale**: No auth system exists. A static password is sufficient to prevent casual access to the admin view. The admin dashboard is read-only (no mutations), limiting the blast radius if the password leaks. The password is stored as an App Setting, never in code.

### Decision 9: localStorage retained as offline cache

**Choice**: Frontend keeps writing to localStorage alongside API calls. Submissions persist locally and sync to the server. Game state remains localStorage-primary.

**Rationale**: This provides resilience if the API is down and preserves the existing player experience (instant local feedback). The server is the source of truth for the shared leaderboard; localStorage is the source of truth for game state.

## API Endpoints

```
POST   /api/sessions          → Create player + game session
PATCH  /api/sessions/:id      → Update session progress counts
POST   /api/events            → Record tile clear / line win / keyword earned
POST   /api/submissions       → Submit keyword for leaderboard
GET    /api/leaderboard       → Aggregated org rankings
GET    /api/admin/dashboard   → Game sessions + submissions (password-protected)
GET    /api/admin/export      → CSV download of submissions (password-protected)
```

### Sequence: Keyword Submission

```
  Player                    Frontend                    Azure Function              Azure SQL
    │                          │                             │                          │
    │  fill form, click submit │                             │                          │
    │─────────────────────────▶│                             │                          │
    │                          │  POST /api/submissions      │                          │
    │                          │  {name,email,org,keyword}   │                          │
    │                          │────────────────────────────▶│                          │
    │                          │                             │  validate keyword format │
    │                          │                             │  resolve email domain    │
    │                          │                             │──────────────────────────▶│
    │                          │                             │  SELECT org_id FROM      │
    │                          │                             │    org_domains WHERE     │
    │                          │                             │    domain = @domain      │
    │                          │                             │◀──────────────────────────│
    │                          │                             │  upsert player by email  │
    │                          │                             │──────────────────────────▶│
    │                          │                             │◀──────────────────────────│
    │                          │                             │  INSERT submission       │
    │                          │                             │  (catch UQ violation)    │
    │                          │                             │──────────────────────────▶│
    │                          │                             │◀──────────────────────────│
    │                          │                             │  check orgDupe           │
    │                          │  {ok, orgDupe, message}     │──────────────────────────▶│
    │                          │◀────────────────────────────│◀──────────────────────────│
    │  show toast + update     │                             │                          │
    │◀─────────────────────────│                             │                          │
    │                          │  GET /api/leaderboard       │                          │
    │                          │────────────────────────────▶│                          │
    │                          │  {leaderboard: [...]}       │  aggregation query       │
    │                          │◀────────────────────────────│◀────────────────────────▶│
    │  display leaderboard     │                             │                          │
    │◀─────────────────────────│                             │                          │
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|---|---|---|
| **No auth — spam submissions** | Fake keywords inflate leaderboard | Server-side keyword format validation (reuse `validateKeywordFormat`); rate limiting by IP in Functions host.json |
| **SQL injection** | Data breach / corruption | All queries use parameterized inputs via `mssql` library; never interpolate user input |
| **Cold start latency** | First request after idle takes 1-2s | Acceptable for hundreds of users; could upgrade to Flex Consumption if needed |
| **CORS misconfiguration** | Frontend can't reach API | Configure allowed origins in Functions host.json; test in staging |
| **Connection string exposure** | Database compromise | Store in App Settings only; .gitignore `local.settings.json`; never log connection strings |
| **Admin password leak** | Unauthorized dashboard access | Dashboard is read-only (no mutations); password is rotatable via App Settings; no sensitive data beyond emails |
| **API downtime during gameplay** | Players can't submit keywords | localStorage fallback keeps game playable; submissions can be retried; leaderboard degrades to local view |

## Migration Plan

1. **Provision Azure SQL Database** (Basic tier) and run migration scripts from `database/`
2. **Deploy Azure Functions** with connection string in App Settings
3. **Update frontend build** to point API base URL to Functions endpoint
4. **Deploy updated SPA** to App Service
5. **Seed organizations** by running `002-seed-organizations.sql`
6. **Verify** end-to-end: submit a keyword → check leaderboard → check admin dashboard

**Rollback**: Revert frontend to the pre-API build. localStorage-only mode is fully functional. Database and Functions can be torn down independently.

## Open Questions

- Should the admin CSV export include game session data (tiles cleared, lines won) or just submissions?
- Should there be a mechanism to retroactively sync existing localStorage submissions to the server (for players who already have local data)?
