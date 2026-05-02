## Context

Player progress is already persisted server-side: `game_sessions.board_state` stores cleared tiles, won lines, keywords, and challenge profile; `pack_assignments` stores the authoritative active pack; `progression_scores` stores score-bearing events. The private-window failure is therefore not missing game-state storage. It is missing ownership proof: an existing `players.email` has `owner_token`, but the new browser context has neither the `player_token` cookie nor the `X-Player-Token` sessionStorage fallback, so `POST /api/sessions` returns `409 Identity in use`.

The current model intentionally prevents silent takeover by email-only lookup. That security property should remain. The new behavior must add a recovery ceremony that proves access to the player email, issues a new player token, and then resumes the existing SQL-backed board state. Admin OTP and player recovery must remain separate because admin authorization is an allow-list decision while player recovery is an email-ownership decision.

## Goals / Non-Goals

**Goals:**
- Let players recover their existing game state from private windows, new devices, and cookie-restricted browsers after verifying access to their player email.
- Preserve anti-takeover behavior: typing someone else's email must not reveal or mutate their player state without email verification.
- Support more than one valid browser/device token for the same player so recovery does not invalidate the original active browser.
- Keep Azure SQL as the durable source of truth; use Redis only for optional short-lived counters or throttling.
- Make the frontend stop local-only progress when server ownership proof is missing and guide the player into recovery.

**Non-Goals:**
- Using Redis as durable game-state storage.
- Granting admin access through player recovery or player access through admin OTP.
- Replacing the existing pack assignment lifecycle or progression scoring models.
- Building password-based accounts, social login, or broad identity-provider integration.
- Solving lost access to the player's email inbox; that remains a support/admin process if needed.

## Decisions

### D1 — Keep SQL as source of truth; use Redis only for short-lived recovery controls
Board state, assignments, submissions, and scoring stay in Azure SQL. Redis MAY hold rate-limit counters such as `player_recovery_request:<email-hash>` or `player_recovery_verify_failures:<email-hash>`, but correctness cannot depend on Redis because local development and transient Redis outages already fall back to SQL for cacheable paths.

**Alternatives considered:** Store board state in Redis to avoid 409. Rejected because 409 is an ownership-proof failure, not a storage-location failure; Redis would add durability and consistency risk without solving private-window identity recovery.

### D2 — Add player-specific recovery OTP endpoints separate from admin OTP
Add two game-surface endpoints:

- `POST /api/player/recovery/request` with `{ email }`
- `POST /api/player/recovery/verify` with `{ email, code }`

The request endpoint returns a neutral success response to avoid email enumeration. If the email maps to an existing player that has a claimed token, the backend stores a hashed recovery code in SQL and sends the code to the player email. The verify endpoint atomically consumes a valid, unexpired recovery code and issues a new player token.

```
Private window                 API                         SQL / Email
     │                          │                              │
     │ POST /sessions           │                              │
     │ email, no token          │                              │
     │─────────────────────────▶│ SELECT player by email       │
     │                          │ owner_token exists           │
     │◀─────────────────────────│ 409 PLAYER_RECOVERY_REQUIRED │
     │                          │                              │
     │ POST /player/recovery/request { email }                 │
     │─────────────────────────▶│ INSERT hashed code           │
     │                          │ SEND code                    │────▶ inbox
     │◀─────────────────────────│ neutral ok                   │
     │                          │                              │
     │ POST /player/recovery/verify { email, code }            │
     │─────────────────────────▶│ UPDATE ... used = 1          │
     │                          │ INSERT device token hash     │
     │◀─────────────────────────│ playerToken + cookie         │
     │                          │                              │
     │ POST /sessions with token│                              │
     │─────────────────────────▶│ verify token, return board   │
     │◀─────────────────────────│ existing assignment/session  │
```

**Alternatives considered:** Reuse admin OTP tables/endpoints. Rejected because admin OTP applies an admin allow-list and issues admin cookies; conflating it with player recovery would make support and security reasoning much harder. Use magic links instead of codes. Viable later, but codes fit the existing ACS email/testing pattern and avoid deep-link routing work.

### D3 — Introduce active player device tokens instead of rotating one owner token
Add an additive `player_device_tokens` table:

```sql
player_device_tokens (
  id INT IDENTITY PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id),
  token_hash NVARCHAR(64) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  last_seen_at DATETIME2 NULL,
  revoked_at DATETIME2 NULL
)
```

Verification accepts either the legacy `players.owner_token` hash or any non-revoked `player_device_tokens.token_hash` for the addressed player. New `POST /api/sessions` token issuance records a device-token row and keeps `players.owner_token` populated for backward compatibility. Recovery verification inserts a new device-token row without overwriting the original browser's token.

**Alternatives considered:** Rotate `players.owner_token` on recovery. Rejected because it solves the private window by breaking the original browser, causing 401/rebootstrap loops during an event. Add plaintext tokens to the database. Rejected; only SHA-256 hashes are stored.

### D4 — Make `POST /api/sessions` conflicts explicitly recoverable
When an existing email lacks matching proof, `POST /api/sessions` continues to return HTTP 409 but should add a stable machine-readable code, for example:

```json
{
  "ok": false,
  "code": "PLAYER_RECOVERY_REQUIRED",
  "message": "Identity in use"
}
```

The response should not reveal whether the email is admin-authorized and should not include sensitive player details. The frontend can use the code to show recovery UI instead of treating all 409s as generic failure.

**Alternatives considered:** Return 200 and silently send a recovery email. Rejected because it surprises users, encourages email spam, and hides the security boundary.

### D5 — Frontend enters a recovery-required state and blocks local-only progress
When setup/launch receives `PLAYER_RECOVERY_REQUIRED`, the SPA should show an inline recovery step. Until recovery succeeds, it should not launch a cached board, verify more tiles, or mint new local keywords for that email. After verification, the SPA stores the returned `playerToken`, calls session/bootstrap again, and hydrates server state from SQL.

```
Setup Panel
    │
    ├─ assignment/session ok ─────────▶ launch board
    │
    └─ 409 PLAYER_RECOVERY_REQUIRED ──▶ recovery form
                                           │
                                           ├─ request code
                                           ├─ verify code
                                           └─ retry session bootstrap
```

**Alternatives considered:** Let local play continue and sync later. Rejected because keywords and score events can diverge from server truth, producing the exact confusion observed in the private-window report.

### D6 — Recovery observability avoids sensitive values
Structured logs should include non-reversible email hashes, outcome labels (`sent`, `not_found_neutral`, `rate_limited`, `verify_success`, `verify_failed`, `email_failed`), and latency, but never raw emails, OTP codes, player tokens, or token hashes. This mirrors the admin OTP observability pattern while staying player-specific.

## Risks / Trade-offs

- **[Risk] Email recovery enables takeover if a player's mailbox is compromised** → Mitigation: this is the same trust boundary used for admin OTP delivery; keep short TTLs, rate limits, and structured monitoring. Lost mailbox access remains a support workflow.
- **[Risk] More than one active device token increases credential surface** → Mitigation: store only hashes, allow future revocation, update `last_seen_at`, and optionally expire or prune stale rows after the event window.
- **[Risk] Neutral recovery request responses can make support harder** → Mitigation: log hashed outcomes and expose clear frontend copy that tells users to check the same email they used for the game.
- **[Risk] ACS email failure blocks recovery** → Mitigation: return a clear retry-later message only when the email is known and send fails; keep existing operational checks for ACS sender configuration.
- **[Risk] Existing specs mention `GET /api/player/state` while current code uses POST after hardening** → Mitigation: delta specs for this change should use the current intended POST shape where relevant and avoid reintroducing URL email leakage.

## Migration Plan

1. Add an idempotent SQL migration for `player_recovery_otps` and `player_device_tokens` with indexes on email/player/token hash and active rows.
2. Add backend recovery request/verify functions and token verification updates behind existing player-token enforcement semantics.
3. Update `POST /api/sessions` to return stable `PLAYER_RECOVERY_REQUIRED` metadata on recoverable conflicts.
4. Update frontend setup/onboarding flow to request/verify recovery and block local board launch while recovery is required.
5. Add unit tests for token verification, recovery OTP request/verify, session conflict shape, and frontend API/recovery state; add Playwright coverage for private-window/new-context recovery.
6. Deploy backend and migration before frontend so the new frontend recovery calls have endpoints available.
7. Post-deploy verification: create a player, open a fresh private browser context with the same email, observe recoverable 409, request/verify recovery, and confirm the board hydrates from SQL.

Rollback: revert frontend recovery UI first to restore generic conflict behavior, then remove or disable recovery endpoints. Leave additive SQL tables in place until a later cleanup; existing `players.owner_token` tokens remain valid throughout.

## Open Questions

- Should recovered device tokens have a fixed expiration, or should they remain valid until explicit cleanup/revocation?
- Should recovery codes be numeric 6-digit like admin OTP or longer alphanumeric to distinguish player recovery emails?
- Should support/admin UI expose a way to revoke all player device tokens for an email after a reported compromise?