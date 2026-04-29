## Context

The Copilot Bingo backend was reviewed in April 2026 and found to expose five game endpoints with no caller authentication: `POST /api/sessions`, `PATCH /api/sessions/:id`, `POST /api/events`, `POST /api/submissions`, and `GET /api/player/state`. They trust client-supplied integer IDs and emails, and IDs are sequential — so an attacker can both enumerate (`gameSessionId++`) and impersonate (post under a victim's email).

Existing auth surfaces in the codebase:

- **Admin auth** uses HS256 JWTs (`backend/src/lib/adminAuth.ts`) with HttpOnly cookies (`backend/src/lib/adminCookies.ts`). The pattern is well-established and works on Azure Static Web Apps + Azure Functions.
- **Players** have no equivalent; identity today is the email string they typed at onboarding. The `MERGE` in `createSession` keys on email, so anyone who knows a victim's email can rewrite their `players.session_id`.

Constraints:

- The existing client API surface is consumed by both the deployed Vue SPA and the Docker-compose smoke environment; the rollout window cannot break either.
- Players cannot be required to verify email (no OTP for players — that would be too heavy for a casual bingo game and would break the existing seamless onboarding).
- Tokens MUST work in third-party-cookie-restricted browsers (Safari ITP) because the SPA is served from a different `*.azurewebsites.net` host than the API. Cookies use `SameSite=None; Secure`; we keep the existing pattern but add a header fallback.

Stakeholders: backend/API, frontend SPA, infra (migration timing).

## Goals / Non-Goals

**Goals:**

- Make `POST /api/events`, `PATCH /api/sessions/:id`, `POST /api/submissions`, `GET /api/player/state`, and email-keyed `MERGE` in `POST /api/sessions` un-exploitable without prior server-issued credentials.
- Keep the change reversible via a single env-var flag during rollout.
- Avoid any user-visible UX change (no extra prompts, no extra clicks).
- Preserve compatibility with the existing `gameSessionId` integer IDs returned to clients (no client-side ID format migration).

**Non-Goals:**

- Player email verification (out of scope; would require per-player OTP infrastructure and conflicts with the casual onboarding flow).
- Replacing integer primary keys with opaque IDs database-wide.
- Changing the leaderboard/admin/auth surfaces — those were addressed in the prior security pass.
- Rate-limiting per IP. (Worth considering separately; not part of this change.)
- Hardening the public `GET /api/leaderboard`, `GET /api/campaigns/active`, `GET /api/organizations/domains` — these are intentionally anonymous and contain only aggregated public data.

## Decisions

### D1. Opaque random token over JWT

Use a 32-byte cryptographically random token (`crypto.randomBytes(32).toString('base64url')`, ~43 chars) and store its SHA-256 hash in `players.owner_token`. Verification is `constantTimeCompare(sha256(presented), stored)`.

**Why**: the token is bound to a database row, never expires (the player keeps the same identity for the campaign), and we never need to decode claims out of it. JWTs would add 100+ bytes per request, require an extra rotation surface, and need symmetric key reuse with the admin secret or a second secret. Hashing the stored value means a database leak doesn't yield usable tokens (cf. how `admin_otps` previously stored bare SHA-256 — we just fixed that).

**Alternatives considered**:

- **JWT signed with `JWT_SECRET`**: rejected because we'd be reusing the admin secret for player-scope tokens, blurring trust boundaries.
- **Per-request HMAC of `(playerId, timestamp)`**: rejected because clients would need to generate it (impossible without the key) or the server would need to vend it on every call.

### D2. Token transport — HttpOnly cookie + header fallback

Primary: HttpOnly cookie `player_token` with `SameSite=None; Secure; Path=/api`. Fallback: `X-Player-Token` request header read from `sessionStorage` when the cookie is unavailable (Safari ITP cross-site case, or curl smoke tests).

**Why**: matches the admin pattern (`backend/src/lib/adminCookies.ts`) and works in the existing CORS setup (`support_credentials = true`). The header fallback gives us a path for environments where third-party cookies are blocked without losing the security benefit (`sessionStorage` is at least partitioned per origin, and the SPA only stores the token after the server has issued it).

**Trade-off**: header-mode has a smaller XSS resistance margin than cookie-mode. Mitigation: existing CSP in [`frontend/nginx.conf`](frontend/nginx.conf) is `script-src 'self'`, so injected `<script>` cannot exfiltrate `sessionStorage`. We do **not** fall back to `localStorage`.

### D3. Issuance flow

`POST /api/sessions` is the only token-issuance endpoint. Behaviour:

1. If the email matches an existing `players` row with a non-null `owner_token`:
   - **AND** the request includes a matching token → reuse and return same token (rotation not required for this change).
   - **AND** the request includes no token / wrong token → return `409 Conflict {ok: false, message: "Identity in use"}` so the legitimate player on another device can recover by clearing their cookie/storage and requesting a new identity through admin support. This is intentional friction: the alternative is allowing silent takeover.
2. If the email matches an existing player with **null** `owner_token` (legacy row, no token issued yet) → atomic `UPDATE ... SET owner_token = @hash WHERE id = @id AND owner_token IS NULL`, return the new token. First device to call wins; subsequent devices get the `409`.
3. If the email is new → insert with the new token's hash, return the token.

**Why this shape**: legacy players (in production today) have null tokens, so the first call after rollout claims their identity. We accept that two devices used by the same legitimate person before rollout will need to re-onboard on one of them — this is a one-time cost, documented in the rollout plan.

### D4. Enforcement on existing endpoints

```
PATCH /api/sessions/:id  → look up game_sessions.player_id → require sha256(token) == players.owner_token
POST  /api/events        → look up game_sessions.player_id (already done) → same check
POST  /api/submissions   → look up player by email (already done) → same check
GET   /api/player/state  → look up player by email (already done) → same check; return same 404-shaped response on mismatch
```

`GET /api/player/state` returns `{ok: true, player: null}` when the token is missing or mismatched, identical to the "no such player" branch. This prevents the existence oracle (H2).

### D5. Feature flag for safe rollout

`ENABLE_PLAYER_TOKEN_ENFORCEMENT` env var (default `'false'` initially, `'true'` after a 24-hour bake-in period during which token issuance is on but enforcement is off). Each enforcing handler reads the flag at the top:

```ts
const enforce = process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT !== 'false';
if (enforce && !verifyPlayerToken(...)) return { status: 401, ... };
```

Issuance always runs so the column populates regardless. This lets us roll back to legacy behaviour without redeploy if a regression is found.

### D6. Migration shape

`009-player-owner-token.sql`:

```sql
IF COL_LENGTH('players', 'owner_token') IS NULL
BEGIN
    ALTER TABLE players ADD owner_token NVARCHAR(64) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_players_owner_token'
      AND object_id = OBJECT_ID('players')
)
BEGIN
    CREATE INDEX IX_players_owner_token ON players(owner_token) WHERE owner_token IS NOT NULL;
END;
```

Filtered index keeps it tiny and only covers populated rows. The column is nullable forever (legacy rows are valid; first authenticated call claims them).

## Sequence

```mermaid
sequenceDiagram
    participant U as Browser
    participant FE as Vue SPA
    participant API as Functions API
    participant DB as Azure SQL

    Note over U,FE: First load
    FE->>API: POST /api/sessions {email,playerName,...}
    API->>DB: SELECT id, owner_token FROM players WHERE email=@email
    DB-->>API: row.owner_token = NULL
    API->>API: token = randomBytes(32).base64url<br/>hash = sha256(token)
    API->>DB: UPDATE players SET owner_token=@hash WHERE id=@id AND owner_token IS NULL
    API-->>FE: 200 + Set-Cookie: player_token=...; HttpOnly + body {playerToken,gameSessionId,...}
    FE->>FE: store playerToken in sessionStorage (fallback)

    Note over U,FE: Subsequent calls
    FE->>API: POST /api/events  (Cookie: player_token=...; X-Player-Token: ...)
    API->>DB: SELECT player_id FROM game_sessions WHERE id=@id<br/>JOIN players ON id=player_id<br/>WHERE owner_token=@hash
    DB-->>API: 1 row
    API-->>FE: 200 ok

    Note over U,FE: Attacker
    participant E as Attacker
    E->>API: POST /api/events  (no cookie, fabricated gameSessionId)
    API->>DB: same query, no token
    DB-->>API: 0 rows
    API-->>E: 401 Unauthorized
```

## Risks / Trade-offs

- **[Risk] Two devices for the same player before rollout**: First device after rollout claims the token; the second sees `409 Conflict` on `POST /api/sessions`. **Mitigation**: feature-flag (D5) lets us delay enforcement; document the recovery path in admin runbook ("clear `players.owner_token` for that email").
- **[Risk] Cookie blocked in cross-origin browsers**: SPA host `*.azurewebsites.net` ≠ API host `*.azurewebsites.net` (different subdomains). **Mitigation**: `SameSite=None; Secure` cookie + `X-Player-Token` header fallback (D2). Frontend reads token from JSON body and stores in `sessionStorage` defensively.
- **[Risk] Token leaks via XSS**: `script-src 'self'` CSP from prior change blocks the obvious vector; no `v-html` usage in the SPA. Residual risk mostly affects `sessionStorage` mode; cookie mode is HttpOnly. **Mitigation**: keep CSP strict; never echo token back in responses after issuance.
- **[Risk] Backfill window where legacy clients can't write**: enforcement-off mode (D5) covers this. After enforcement flips to on, any legacy client that didn't pick up the issued token on its previous call will be silently re-prompted to call `createSession` again — which on cookie-supporting browsers is transparent.
- **[Trade-off] No token rotation in this change**: a stolen token is valid until DB reset. We accept this for v1 because (a) the impact is one player's progress, (b) tokens are HttpOnly+CSP-protected, (c) we can add rotation as a follow-up by adding `owner_token_issued_at` and a `POST /api/sessions/rotate` endpoint without schema changes beyond the timestamp.

## Migration Plan

1. **PR 1 (this change)**: ship migration `009`, backend code with `ENABLE_PLAYER_TOKEN_ENFORCEMENT=false` (issuance on, enforcement off), frontend that captures and forwards the token. Deploy infra (Terraform sets the env var).
2. **24-hour bake**: monitor App Insights for `player_token_issued` events; verify the column populates and existing player traffic remains green.
3. **Flip flag**: set `ENABLE_PLAYER_TOKEN_ENFORCEMENT=true` in the Function App app settings (no redeploy needed).
4. **Monitor 401 rate**: expect a small spike from stale tabs/old cached SPAs. Alert if >2% of game-endpoint requests 401 for >5 minutes.
5. **Rollback**: set the flag back to `false`. Issuance continues so the column stays populated; enforcement disappears.

## Open Questions

- Should we expose a `DELETE /api/portal-api/players/:id/token` admin action so operators can clear `owner_token` for the recovery case (D5 risk)? Tentative yes, but it's a one-line admin endpoint that can land in a follow-up.
- Header name: `X-Player-Token` chosen here for symmetry with `X-Admin-Key`. Open to `Authorization: Player <token>` if reviewers prefer standard prefixes.
