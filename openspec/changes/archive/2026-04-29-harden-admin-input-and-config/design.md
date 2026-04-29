## Context

Four findings from the April-29 security review, grouped because they all live in admin-write paths or in adjacent configuration code, all have small diffs, and all benefit from being shipped together so the test matrix only runs once:

- **L1 — `copilotUrl` not validated server-side**. [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts) accepts any string for `copilotUrl` on create/update. Today the SPA hard-codes the URL via [frontend/src/data/constants.js](frontend/src/data/constants.js) and never binds the per-campaign value to `:href`, so no XSS sink exists right now. This is forward-defense.
- **L4 — Express dev wrapper drift**. [backend/server.js](backend/server.js) reimplements admin players, orgs, and campaigns inline (~ 600 lines of `adminPlayerHandler`, `adminOrgHandler`, `adminCampaignHandler`). It's missing the LIKE-wildcard escape that lives in [backend/src/functions/adminPlayers.ts](backend/src/functions/adminPlayers.ts). The header at the top of the file says "Not used in production. Azure Functions runtime is used in prod" but the file is still wired into [backend/Dockerfile](backend/Dockerfile)'s `CMD ["node", "server.js"]`, and any local test using the Docker stack hits this divergent path.
- **I3 — Oversized `totalPacks` / `totalWeeks`**. [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts#L48) defaults `totalPacks` to `999`. The pack-assignment code in [backend/src/lib/packAssignments.ts](backend/src/lib/packAssignments.ts) iterates over the assigned pack space when finding the next active assignment; an admin typo of `999999` would cause an expensive enumeration on first-player creation.
- **I4 — `ENABLE_PLAYER_TOKEN_ENFORCEMENT` Terraform pinning**. [backend/src/lib/playerAuth.ts](backend/src/lib/playerAuth.ts) defaults to enabled and only the literal string `'false'` disables it. The variable is set by Terraform at `local.app_settings.ENABLE_PLAYER_TOKEN_ENFORCEMENT = tostring(var.enable_player_token_enforcement)`, but the variable's default isn't visible at the call site and the input is unconstrained. If anyone ever changes the variable's default to `false` to debug, that becomes the production default.

Constraints: same as the broader stack (Azure Functions v4 TS, Vitest, mssql parameterized queries). Existing test suites must keep passing without modification beyond the new cases.

## Goals / Non-Goals

**Goals:**
- Each finding is closed with a small, targeted edit and at least one Vitest case.
- The dev Express wrapper produces the same authorization, validation, and SQL behavior as the prod handlers — by construction, not by re-implementation.
- Configuration values that affect security posture are explicit in Terraform with input validation, not load-bearing on language defaults.

**Non-Goals:**
- Rebuilding the local Docker dev story end-to-end (e.g. switching to `func start`-in-container).
- Changing the campaign data model (`copilot_url` column stays NVARCHAR(500)).
- Adding URL allowlisting beyond scheme — host validation belongs to a future change if/when we host an admin-controlled redirect.
- Reducing the player-token enforcement default — the goal is to pin it explicitly to its current value (`true`).

## Decisions

### D1 — URL validation helper in `http.ts`
Add a small helper in [backend/src/functions/http.ts](backend/src/functions/http.ts):

```ts
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
```

Then [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts) `createCampaign` and `updateCampaignSettings` reject with `400 { ok: false, message: 'copilotUrl must be an https:// URL' }` when the supplied value is non-empty AND not an https URL. Empty / undefined keep existing fallback behavior (default constant on create, no-op on update).

**Alternatives considered**: (a) Allowlist a specific host — rejected because the project supports custom Copilot endpoints. (b) Use a regex — rejected because URL parsing handles edge cases (whitespace, mixed-case scheme) more robustly.

### D2 — Numeric bounds helper for `totalPacks` / `totalWeeks`
Add `boundedInteger(value, min, max)` next to `numberValue` in [backend/src/functions/http.ts](backend/src/functions/http.ts). Return `null` when out of range so the existing `||` defaults still work. Apply to:
- `totalPacks`: `min = 1, max = 10000`
- `totalWeeks`: `min = 1, max = 52`

These bounds are roomy compared to current production usage (`totalPacks = 999, totalWeeks = 7`) but small enough to prevent runaway loops or pathological assignment matrices.

**Alternatives considered**: clamping silently to the bounds — rejected because silent clamping hides admin typos. Returning a 400 makes the typo obvious.

### D3 — Replace inline admin handlers in `server.js` with `adapt()` calls
[backend/server.js](backend/server.js) already uses an `adapt(handlerModule)` helper for ~17 simple endpoints. Extend that pattern to the multi-handler files by importing the named exports added at the bottom of [backend/src/functions/adminPlayers.ts](backend/src/functions/adminPlayers.ts) (already exports `searchPlayers`, `getPlayerDetail`, `deletePlayer`, `revokeSubmission`), [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts) (verify exports — add a top-level `export { listCampaigns, createCampaign, updateCampaignSettings, clearCampaignData, resetLeaderboard }` at the end of the file), and [backend/src/functions/adminOrganizations.ts](backend/src/functions/adminOrganizations.ts) (same pattern: add named exports for each handler).

Then `server.js` becomes:
```js
const { searchPlayers, getPlayerDetail, deletePlayer, revokeSubmission } =
  await import('./dist/functions/adminPlayers.js');
app.get('/api/portal-api/players',         adapt({ handler: searchPlayers }));
app.get('/api/portal-api/players/:id',     adapt({ handler: getPlayerDetail }));
app.delete('/api/portal-api/players/:id',  adapt({ handler: deletePlayer }));
app.delete('/api/portal-api/submissions/:id', adapt({ handler: revokeSubmission }));
```

The ~600 lines of `adminPlayerHandler` / `adminOrgHandler` / `adminCampaignHandler` get deleted. The file shrinks substantially and dev/prod behavior converges by construction.

**Alternatives considered**: (a) Delete `server.js` entirely — rejected because Docker dev still needs an entry point and `func start` in a container is a bigger lift. (b) Keep parallel implementations and add the missing wildcard escape — rejected because drift will recur.

### D4 — Pin `ENABLE_PLAYER_TOKEN_ENFORCEMENT` in Terraform variables
In [infra/terraform/variables.tf](infra/terraform/variables.tf), audit the `enable_player_token_enforcement` variable. Ensure:
- `default = true`
- `type = bool` with a `validation { condition = contains([true, false], var.enable_player_token_enforcement) … }` block (the type alone enforces this, but adding a `description` that explicitly says "MUST stay `true` in production; only set to `false` for emergency rollback" is the actual goal).
- Update the description to reference the security spec.

[infra/terraform/main.tf](infra/terraform/main.tf) already reads it as `tostring(var.enable_player_token_enforcement)`. Confirm the Function App `app_settings` map renders it as the literal string `"true"` so [backend/src/lib/playerAuth.ts](backend/src/lib/playerAuth.ts)'s `process.env.ENABLE_PLAYER_TOKEN_ENFORCEMENT !== 'false'` check evaluates true.

**Alternatives considered**: hard-coding the value in [infra/terraform/main.tf](infra/terraform/main.tf) — rejected because keeping it in `variables.tf` lets emergency rollback happen via `tfvars` without a code change, while the description discourages misuse.

## Risks / Trade-offs

- **[Risk] D3 introduces a new compile dependency**: `server.js` now imports from `dist/functions/admin*.js`, which means the `adminCampaigns.ts` / `adminOrganizations.ts` files MUST export their handlers by name. Mitigation: tasks 3.1 and 3.2 add the missing exports first; the existing `adminPlayers.ts` already does this so the pattern is proven.
- **[Risk] Bounds rejection breaks an in-flight admin workflow**: small risk because production values are well within bounds. Mitigation: the new validation messages quote the limits so the admin sees what to fix.
- **[Risk] Variable validation block might fire on existing `terraform.tfvars` files** with non-boolean strings: low because the project's existing `tfvars.example` already uses `true`/`false`. Mitigation: a `terraform plan` post-merge will flag any drift before apply.
- **[Trade-off] Server-side URL check rejects schemes that some legitimate test setups use** (e.g. `http://localhost:5173/copilot`). Mitigation: tests can set the env directly; the API's job is to keep stored values safe for browser rendering.
