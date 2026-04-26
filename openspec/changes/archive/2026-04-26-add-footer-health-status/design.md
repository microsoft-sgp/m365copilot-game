## Context

The Copilot Chat Bingo app is a Vue 3 frontend backed by Azure Functions v4 and Azure SQL. Today, when the API or database is unavailable, the frontend silently falls back to local state (see `App.vue` `syncPlayerState`, `useSubmissions.submit`, and `request()` in `frontend/src/lib/api.js`, which normalizes failures to `status: 0`). Players have no visible signal that submissions or progress sync may be failing.

The footer is centralized in `frontend/src/components/GameFooter.vue` and rendered on game-facing views only — admin views (`AdminLayout`, `AdminLogin`) never include it. The backend has no dedicated health endpoint; existing public endpoints (`getActiveCampaign`, `getOrgDomains`, `getPlayerState`) all touch the database, so they cannot cleanly distinguish API-process health from database health.

## Goals / Non-Goals

**Goals:**
- Add a small, always-visible service-status indicator to the footer of game-facing views.
- Distinguish three operational outcomes from the player's perspective: API + DB healthy, DB degraded, API offline.
- Provide a single backend health endpoint that ops, smoke tests, and the footer can all consume.
- Keep the indicator unobtrusive: dot + short word, no tooltip, no jargon.

**Non-Goals:**
- Showing health on admin views (admins have logs/dashboards already).
- Health for any dependency beyond the SQL database (no Redis/email/Copilot-URL probes in this change).
- Auto-recovery actions, retries, or user-facing reconnect controls.
- Historical uptime, charts, or status-page features.
- Authenticated/per-user health information.

## Decisions

### Decision 1: Add a dedicated `GET /api/health` endpoint instead of reusing an existing endpoint

**Choice:** Implement `GET /api/health` returning `{ ok, status: "healthy"|"degraded"|"down", api: "up", database: "up"|"down", checkedAt }`.

**Rationale:** Reusing an existing endpoint (e.g., `GET /api/campaigns/active`) confuses business errors (no active campaign → 404) with infrastructure failures, producing false `Degraded` labels. A dedicated endpoint gives stable semantics and lets us probe DB with a minimal `SELECT 1` query, isolating cost and latency from real business reads. It is also reusable by `scripts/smoke-test.sh` and any future external uptime monitor.

**Alternatives considered:**
- *Reuse `getOrgDomains`*: cheap and DB-touching, but a successful response still doesn't distinguish "API up, DB up" from "stale cache"; a future caching layer would silently break the signal.
- *Two endpoints (`/api/ping` + `/api/db-ping`)*: cleaner separation but doubles request volume and adds two routes for marginal benefit. A single endpoint with structured fields is sufficient.

### Decision 2: Database probe is a minimal `SELECT 1` against the shared pool

**Choice:** The handler calls `getPool()` and runs `SELECT 1 AS ok` with a short timeout. Any thrown error → `database: "down"`, overall `status: "degraded"`.

**Rationale:** Keeps the probe O(1), avoids touching real tables, and reuses the existing connection pool in `backend/src/lib/db.js` so a healthy probe also confirms pool acquisition works. Wrapping in try/catch ensures the endpoint always returns 200 with structured status rather than throwing 500 — important so the frontend can distinguish "API process responded with degraded" from "API unreachable".

**Alternatives considered:**
- *Querying a real table* (`SELECT TOP 1 id FROM campaigns`): noisier, couples health to business schema, and risks false negatives during migrations.
- *Returning HTTP 503 on DB failure*: makes it harder for the footer to distinguish API-down (network error) from DB-down (API responds with 503). Returning 200 with structured fields is unambiguous.

### Decision 3: Frontend states — `Unknown` / `Healthy` / `Degraded` / `Down`

**Choice:** Four-state model. Initial `Unknown` shown until the first response. `Down` only when the API is unreachable or times out. `Degraded` only when the API responds with `database: "down"`.

**Rationale:** Matches the natural failure modes a player can observe and avoids hiding/showing the slot (which would cause layout reflow on first paint). Using the existing `request()` convention (`status: 0` on network failure) makes mapping trivial.

```
              ┌─────────┐
   mount ───▶ │ Unknown │
              └────┬────┘
       first probe response
                   ▼
   ┌─────────┐  ┌──────────┐  ┌────────┐
   │ Healthy │  │ Degraded │  │  Down  │
   │ (green) │  │ (amber)  │  │ (red)  │
   └────┬────┘  └────┬─────┘  └───┬────┘
        └────── 30s poll + visibilitychange ──────┘
```

### Decision 4: 30-second polling cadence with mount probe and visibility re-probe

**Choice:** Probe immediately on mount, then every 30s. Also re-probe on `document.visibilitychange` when the tab becomes visible after being hidden.

**Rationale:** 30s aligns with the existing leaderboard poll in `useSubmissions.startPolling`, keeps background traffic low, and is fast enough that a player typically notices state changes within one cycle. Visibility re-probe avoids stale `Healthy` after a backgrounded laptop wakes. Pure event-driven (only refresh on real API errors) was rejected because it cannot recover the label to `Healthy` on its own and misses idle-state degradations.

### Decision 5: Footer scope only on game views; compact dot + word; no tooltip

**Choice:** Render the label inside `GameFooter.vue`, above the existing two attribution lines. Composition: one colored circular dot + one short word (`Online` / `Degraded` / `Offline` / `Checking…`). Visible-text only, no tooltip, no admin/DB jargon in the player UI.

**Rationale:** Per the existing `game-footer` spec, the footer is hidden on admin views, so this reuses that scoping for free. Admins have richer signals; players need a glanceable indicator. Dropping the tooltip simplifies accessibility (no hover-only information) and matches the user's stated preference.

### Decision 6: Sequence diagram for the probe flow

```
Footer (mount)        useHealthStatus       apiGetHealth     /api/health      DB pool
     │                       │                   │                │              │
     │── start() ──────────▶ │                   │                │              │
     │                       │── probe() ──────▶ │── GET /health▶ │              │
     │                       │                   │                │── SELECT 1 ─▶│
     │                       │                   │                │◀──── ok ─────│
     │                       │                   │◀── 200 JSON ── │              │
     │                       │◀── status update ─│                │              │
     │◀── reactive update ───│                   │                │              │
     │                                                                            │
     │── (every 30s / on visibilitychange) ───── repeat probe ────────────────── │
     │                                                                            │
     │── (DB failure path) ──── GET /health ──▶ SELECT 1 throws ──▶ catch ─────── │
     │                          ◀── 200 { database: "down", status: "degraded" } ─│
     │                                                                            │
     │── (API offline path) ─── GET /health ──▶ network error ──▶ status: 0 ──── │
     │                          ◀── frontend maps to "Down" ─────────────────────│
```

## Risks / Trade-offs

- **Risk:** Health endpoint becomes a hot path on a free-tier DB → small load increase from `SELECT 1`. **Mitigation:** Polling at 30s per active player keeps requests bounded; the query is O(1) and uses the warm shared pool.
- **Risk:** False `Down` during transient network blips causes UI flicker. **Mitigation:** Single failed probe transitions to `Down`; subsequent successful probe restores `Healthy` within 30s. Acceptable trade-off for honesty over hiding short outages.
- **Risk:** Anonymous health endpoint could be used for reconnaissance or scraped. **Mitigation:** Response contains no business data, no version strings, no environment names — only boolean-ish health fields and a UTC timestamp. Same authLevel as other public endpoints.
- **Risk:** Color-only state is inaccessible to colorblind users. **Mitigation:** Always pair the dot with a textual word; use Tailwind tokens consistent with existing palette and ensure contrast meets WCAG AA against footer background.
- **Trade-off:** Adding a second timer parallel to leaderboard polling. **Mitigation:** Use a single setInterval inside the composable with start/stop lifecycle hooks; keep it independent so it works on EmailGate (no leaderboard) too.

## Migration Plan

1. Ship backend `health.js` and Express adapter route together — endpoint is additive and safe to deploy ahead of the frontend.
2. Smoke-test: `curl /api/health` returns `200` with `status: "healthy"` against a healthy stack.
3. Ship frontend composable + footer label.
4. **Rollback:** Single revert of the change PR. No schema changes, no breaking API contract changes — the new endpoint can stay even if the UI is reverted, or both can be removed cleanly.

## Open Questions

- None blocking. Future enhancement: extend health payload with cache/email status if/when those dependencies are added, without breaking the current contract (additive fields only).
