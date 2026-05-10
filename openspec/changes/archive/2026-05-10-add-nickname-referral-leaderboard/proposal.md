## Why

Players currently provide a display name, but the product does not frame it as a public nickname and the organization leaderboard hides the people contributing to each organization's score. Event organizers also need a lightweight way to attribute new players to Student Ambassadors during onboarding, with the ambassador list supplied later.

## What Changes

- Rename player-facing and admin-visible name language to "Nickname" while preserving the existing player identity behavior and backend compatibility.
- Preserve the organization leaderboard ranking model and add top contributor nickname visibility for each organization.
- Return the top five contributor nicknames per organization from `GET /api/leaderboard`, ranked by contribution count within that organization and campaign, with recency as the tie-breaker.
- Render the top contributor nicknames in the organization leaderboard without changing score calculation or rank ordering.
- Add an optional referral code field during initial onboarding and carry it into session bootstrap.
- Introduce Student Ambassador referral attribution so valid referral codes can be resolved and stored when a player identity is first created or claimed.
- Keep referral attribution separate from scoring; referral codes do not affect packs, score, rank, or organization attribution.

## Capabilities

### New Capabilities

- `student-ambassador-referrals`: Defines Student Ambassador referral-code catalog behavior, onboarding validation, and player attribution.

### Modified Capabilities

- `player-identity`: Reframes onboarding display name as nickname and includes optional referral code capture during initial onboarding.
- `game-api`: Extends session creation to accept referral codes and extends leaderboard responses with top contributor nickname metadata.
- `bingo-frontend`: Updates onboarding and organization leaderboard UI behavior to use nickname terminology and display top contributor nicknames.
- `game-database`: Adds durable referral attribution structures and clarifies nickname storage semantics while maintaining compatibility with existing `player_name` data.
- `admin-portal`: Updates admin player-management terminology from name to nickname where player identity is displayed or searched.
- `admin-dashboard`: Updates dashboard and export terminology so player identity columns are presented as nicknames.

## Impact

- Affected frontend: onboarding identity gate, local identity storage labels, organization leaderboard table, admin player-management tables, admin dashboard tables, and associated Vitest/Playwright expectations.
- Affected backend: `POST /api/sessions`, `GET /api/leaderboard`, admin dashboard/export queries or response shaping, and unit tests for session creation and leaderboard aggregation.
- Affected database: additive migration for Student Ambassador referral-code records and player referral attribution; no destructive rename is required for `players.player_name`.
- Affected API contract: leaderboard rows gain optional top-contributor nickname fields; session creation accepts an optional referral code. Existing clients that ignore unknown fields remain compatible.
- Affected teams: event organizers, Student Ambassador coordinators, player experience/frontend maintainers, backend/API maintainers, data/admin-reporting consumers.
- Rollback plan: hide the leaderboard nickname column in the frontend, ignore referral-code input in session creation, and leave additive referral tables/columns unused. Because the existing `player_name` field is preserved, no data migration rollback is required for nickname terminology.