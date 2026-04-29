## 1. Helpers in http.ts

- [x] 1.1 In [backend/src/functions/http.ts](backend/src/functions/http.ts), add `export function isHttpsUrl(value: unknown): value is string` that returns `true` only when `value` is a non-empty string AND `new URL(value).protocol === 'https:'`. Wrap the URL parse in `try { … } catch { return false; }` to handle malformed input.
- [x] 1.2 In [backend/src/functions/http.ts](backend/src/functions/http.ts), add `export function boundedInteger(value: unknown, min: number, max: number): number | null` that returns the integer when in range, otherwise `null`. Reuse `numberValue` internally.
- [x] 1.3 Add Vitest cases in a new [backend/src/functions/http.test.js](backend/src/functions/http.test.js) (or extend an existing helper test if one exists) covering: `isHttpsUrl('https://example.com') === true`, `isHttpsUrl('javascript:alert(1)') === false`, `isHttpsUrl('http://example.com') === false`, `isHttpsUrl('') === false`, `isHttpsUrl('not a url') === false`. Add `boundedInteger` cases for in-range, below-min, above-max, and non-numeric inputs.

## 2. Apply validation in adminCampaigns

- [x] 2.1 In [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts) `createCampaign`, after `const copilotUrl = stringValue(body.copilotUrl) || 'https://m365.cloud.microsoft/chat';` block:
  - When the body explicitly provided `copilotUrl` (non-empty string) AND `!isHttpsUrl(copilotUrl)`, return `400 { ok: false, message: 'copilotUrl must be an https:// URL' }`.
  - Replace `numberValue(body.totalPacks) || 999` with `boundedInteger(body.totalPacks, 1, 10000) ?? (body.totalPacks == null ? 999 : null)`. If the result is `null` (out-of-range explicit value), return `400 { ok: false, message: 'totalPacks must be between 1 and 10000' }`.
  - Same shape for `totalWeeks` with bounds `[1, 52]` and default `7`.
- [x] 2.2 In [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts) `updateCampaignSettings`, before the SQL UPDATE:
  - When `copilotUrl` is provided and non-empty, require `isHttpsUrl(copilotUrl)`; otherwise `400 { ok: false, message: 'copilotUrl must be an https:// URL' }`. Empty / undefined keep the existing `COALESCE(@copilotUrl, copilot_url)` no-op behavior.
  - When `totalPacks` is provided, require it to pass `boundedInteger(value, 1, 10000)`; same for `totalWeeks` with `[1, 52]`. Return `400` with the matching message on failure.
- [x] 2.3 Add Vitest cases in [backend/src/functions/adminCampaigns.test.js](backend/src/functions/adminCampaigns.test.js): `javascript:` rejected on create, `http://` rejected on create, `https://` accepted on create, `data:` rejected on update, `totalPacks: 100000` rejected on create, `totalWeeks: 999` rejected on update, default values still produce a 200 when fields are omitted.
- [x] 2.4 Run `npm test --prefix backend` and confirm all `adminCampaigns.test.js` cases pass.

## 3. Add named handler exports for dev wrapper

- [x] 3.1 At the bottom of [backend/src/functions/adminCampaigns.ts](backend/src/functions/adminCampaigns.ts), add `export { listCampaigns, createCampaign, updateCampaignSettings, clearCampaignData, resetLeaderboard };` if not already present. Verify with `grep "^export {" backend/src/functions/adminCampaigns.ts`.
- [x] 3.2 At the bottom of [backend/src/functions/adminOrganizations.ts](backend/src/functions/adminOrganizations.ts), add `export { listOrganizations, createOrganization, updateOrganization, deleteOrganization, addDomain, removeDomain };`.
- [x] 3.3 Confirm [backend/src/functions/adminPlayers.ts](backend/src/functions/adminPlayers.ts) already exports `searchPlayers, getPlayerDetail, deletePlayer, revokeSubmission` (it does as of the current branch).
- [x] 3.4 Run `npm run build --prefix backend` and `npm run typecheck --prefix backend`; resolve any errors.

## 4. Replace inline handlers in server.js

- [x] 4.1 In [backend/server.js](backend/server.js), delete the entire `async function adminOrgHandler(...)`, `async function adminCampaignHandler(...)`, and `async function adminPlayerHandler(...)` blocks (currently ~600 lines). Also delete the `await import('./dist/lib/adminAuth.js')` and `(await import('mssql')).default` calls inside them — they will be unused after deletion.
- [x] 4.2 Replace those handlers with direct `adapt({ handler: <named-export> })` route registrations, e.g.:
  ```js
  const { searchPlayers, getPlayerDetail, deletePlayer, revokeSubmission } =
    await import('./dist/functions/adminPlayers.js');
  app.get('/api/portal-api/players',         adapt({ handler: searchPlayers }));
  app.get('/api/portal-api/players/:id',     adapt({ handler: getPlayerDetail }));
  app.delete('/api/portal-api/players/:id',  adapt({ handler: deletePlayer }));
  app.delete('/api/portal-api/submissions/:id', adapt({ handler: revokeSubmission }));
  ```
  Repeat for `adminCampaigns` (`listCampaigns`, `createCampaign`, `updateCampaignSettings`, `clearCampaignData`, `resetLeaderboard`) and `adminOrganizations` (`listOrganizations`, `createOrganization`, `updateOrganization`, `deleteOrganization`, `addDomain`, `removeDomain`). Verify route paths match the `app.http(..., { route: '...' })` registrations in each TS file.
- [x] 4.3 Verify line count of [backend/server.js](backend/server.js) drops substantially (target ≤ 200 lines from current ~700+).
- [x] 4.4 Local Docker smoke: `docker compose down -v && docker compose build backend && docker compose up -d`. Then `curl http://localhost:7071/api/health` returns 200, and the admin routes still respond (e.g. `curl -H "X-Admin-Key: <local-key>" http://localhost:7071/api/portal-api/campaigns` returns the same JSON shape as before).

## 5. Pin Terraform variable

- [x] 5.1 In [infra/terraform/variables.tf](infra/terraform/variables.tf), locate the `enable_player_token_enforcement` variable. Confirm `type = bool` and `default = true`. If either is missing, add them.
- [x] 5.2 Update the variable's `description` to: `"Enable server-side enforcement of the per-player session token on game-API mutations. MUST stay true in production. Set to false only as an emergency rollback for the player-session-auth capability."`
- [x] 5.3 Verify [infra/terraform/main.tf](infra/terraform/main.tf) `local.app_settings` already contains `ENABLE_PLAYER_TOKEN_ENFORCEMENT = tostring(var.enable_player_token_enforcement)` — it does today, no edit needed unless the line has been removed.
- [x] 5.4 In [infra/terraform/terraform.tfvars.example](infra/terraform/terraform.tfvars.example), add an explicit `enable_player_token_enforcement = true` line if it is not already present, with a comment matching the variable description.
- [x] 5.5 `terraform fmt -check -recursive` and `terraform validate` from the [infra/terraform/](infra/terraform/) directory.
- [x] 5.6 Run `terraform plan` (without applying); confirm the plan output shows no changes OR shows only the `app_settings` map gaining the explicit value (depending on whether the previous deploy had it set). _(Result: ran on 2026-04-29 against `sub-oneunified-development`. Plan summary: `0 to add, 4 to change, 0 to destroy`. The Function App `app_settings` show **no diff** — the live deployment already has `ENABLE_PLAYER_TOKEN_ENFORCEMENT = "true"`, so flipping the variable default makes the Terraform code match what's deployed without producing any change. The 4 in-place updates are pre-existing out-of-band drift on Key Vault / SQL / Storage / frontend App Service that are unrelated to this change. Plan exited with errors reading 4 Key Vault secrets because the live vault has public network access disabled — also pre-existing drift, not caused by this PR.)_

## 6. Validation

- [x] 6.1 `npm test --prefix backend` — full Vitest pass.
- [x] 6.2 `npm run lint --prefix backend` and `npm run typecheck --prefix backend` — no new warnings or errors.
- [x] 6.3 `openspec validate --strict harden-admin-input-and-config` — passes.
- [x] 6.4 Manual smoke: in the local stack, attempt `POST /api/portal-api/campaigns` with `copilotUrl: 'javascript:alert(1)'` and confirm 400; attempt with `copilotUrl: 'https://example.com'` and confirm 200.
