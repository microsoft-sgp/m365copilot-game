## Why

The April-29 security review surfaced four small, mostly-hardening findings clustered around admin input validation, dev/prod parity, and configuration explicitness. Bundling them into one change keeps each diff trivially reviewable while collectively reducing surface area: an admin (or attacker who has reached admin) cannot store a `javascript:` URL on a campaign; the local Express dev wrapper stops drifting from prod handlers; oversized `totalPacks` values cannot DoS the pack-assignment loop; and the player-token enforcement flag is set explicitly by Terraform so future env-var refactors cannot silently disable it.

## What Changes

- **L1 — Validate `copilotUrl` server-side** in `POST /api/portal-api/campaigns` and `PUT /api/portal-api/campaigns/:id/settings`. Require `new URL(value).protocol === 'https:'` and reject other schemes (notably `javascript:`, `data:`, `file:`) with HTTP 400. Today the URL is only ever rendered via a hard-coded constant on the frontend, so this is forward-protection for the day someone binds it to `:href` in a Vue component.
- **L4 — Stop reimplementing prod handlers in [backend/server.js](backend/server.js)**. The dev Express wrapper currently duplicates admin player search / org / campaign logic (and drifts: it omits the LIKE-wildcard escape that [backend/src/functions/adminPlayers.ts](backend/src/functions/adminPlayers.ts) applies). Refactor `server.js` to import the compiled handlers from `dist/functions/*.js` and adapt them with the same `adapt()` shim already used for the simple handlers — no parallel SQL anywhere in the file.
- **I3 — Cap `totalPacks` and `totalWeeks` server-side** at safe upper bounds (`totalPacks <= 10000`, `totalWeeks <= 52`). Currently the create endpoint accepts any integer and defaults to `999` packs; downstream pack-assignment code loops over this. A typo of `999999` could trigger expensive enumeration on first-player assignment.
- **I4 — Make `ENABLE_PLAYER_TOKEN_ENFORCEMENT` explicit in Terraform**. The variable already exists in `app_settings` of [infra/terraform/main.tf](infra/terraform/main.tf) as `tostring(var.enable_player_token_enforcement)`, but the input variable defaults need to be audited and pinned to `true` so an unset value cannot weaken enforcement on a fresh deployment. Add an explicit `validation` block on the variable so non-boolean values are rejected at plan time.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `campaign-config`: campaign create / update endpoints gain server-side URL scheme validation and `totalPacks`/`totalWeeks` bounds checks.
- `target-runtime-architecture`: target deployment configuration adds an explicit "player token enforcement is set in Terraform" scenario.
- `player-session-auth`: token enforcement feature flag scenario gains a "Terraform pins the value" requirement so the flag's default is no longer load-bearing in production.

## Impact

- **Code**: [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts) (URL validator + numeric bounds), small URL/bounds helper in [backend/src/functions/http.ts](backend/src/functions/http.ts), [backend/server.js](backend/server.js) (delete the inline `adminOrgHandler` / `adminCampaignHandler` / `adminPlayerHandler` blocks; route directly through compiled handlers via `adapt()`), [infra/terraform/main.tf](infra/terraform/main.tf) and [infra/terraform/variables.tf](infra/terraform/variables.tf) (pin `ENABLE_PLAYER_TOKEN_ENFORCEMENT` and add validation).
- **Tests**: new Vitest cases for `adminCampaigns.test.js` covering rejected schemes and oversized counts; refresh `App.test.js`/Docker e2e if the dev wrapper change breaks any local-stack assumption (it should not).
- **APIs**: `POST /api/portal-api/campaigns` and `PUT /api/portal-api/campaigns/:id/settings` now return HTTP 400 for non-https URLs and out-of-range counts. Today's frontend only ever sends `https://m365.cloud.microsoft/chat`, so user-visible impact is zero.
- **Dependencies**: none new.
- **Rollback**: revert the PR. No infra rebuild needed; the Terraform variable change only re-asserts the existing default.
- **Affected teams**: backend (handlers + tests), ops (re-run `terraform apply` to pick up the explicit variable + validation block).
