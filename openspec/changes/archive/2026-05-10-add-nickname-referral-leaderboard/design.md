## Context

The app already stores the player's onboarding display value in `players.player_name`, passes it through the frontend as `playerName`, and treats it as immutable for normal player flows. Public scoring has moved to progression-derived organization rankings, so `GET /api/leaderboard` currently returns organization rows with score, contributor count, and last submission time, but no player-visible names.

This change keeps the organization leaderboard as the primary ranked surface while adding human-readable nickname context. It also introduces optional Student Ambassador referral attribution at onboarding. The ambassador list is expected later, so the implementation must support an initially empty or seeded catalog without requiring application code changes.

## Goals / Non-Goals

**Goals:**

- Use "Nickname" terminology anywhere the player-facing or admin-facing UI labels the player's public display identity.
- Preserve the existing `players.player_name` data and API compatibility while treating that value as the canonical nickname.
- Add top five contributor nicknames to each organization leaderboard row without changing organization ranking or score calculation.
- Capture an optional referral code during onboarding and attribute the player to a valid Student Ambassador code when the player session is created.
- Keep referral attribution additive, auditable, and independent from scoring, assignment, recovery, and organization resolution.

**Non-Goals:**

- Do not replace the organization leaderboard with an individual player leaderboard.
- Do not allow players to edit nicknames after onboarding through normal gameplay flows.
- Do not make referral codes required for play.
- Do not use referral codes to determine organization, pack assignment, score, rank, or eligibility.
- Do not physically rename `players.player_name` in this change.

## Decisions

### Keep `players.player_name` as the backing nickname column

The canonical nickname will continue to live in `players.player_name`, with frontend labels, admin labels, API docs, and response aliases using nickname terminology where helpful. This avoids a risky physical column rename across migrations, exports, tests, and existing deployed data.

Alternative considered: add or rename a `nickname` column. A physical rename would create avoidable migration and rollback risk. A parallel column would require dual-write and backfill logic for little product value right now.

### Extend organization leaderboard rows with top contributor metadata

The leaderboard remains grouped and sorted by organization score. The backend will compute top contributors per organization and campaign by grouping progression scoring records by `org_id` and `player_id`, ordering by contributor score descending, then most recent contribution descending, then nickname ascending for deterministic ties. Each organization row will include up to five contributors plus a hidden contributor count.

Suggested response shape:

```json
{
  "rank": 1,
  "org": "NUS",
  "score": 42,
  "contributors": 8,
  "topContributors": [
    { "nickname": "Ada", "score": 9 },
    { "nickname": "Kai", "score": 7 }
  ],
  "hiddenContributorCount": 3,
  "lastSubmission": "2026-05-10T12:34:56.000Z"
}
```

The UI should display names compactly, for example `Ada, Kai, Mei, Jon, Noor +3`. Counts can remain in the API for testing and future detail views, but the table should emphasize readable nickname presence over dense metrics.

Alternative considered: a separate player leaderboard. That would be a larger product shift and would compete with the existing organization-first event model.

### Store referral catalog and attribution separately

Use additive tables rather than overloading organization or player fields:

- `student_ambassadors`: `id`, `campaign_id`, `display_name`, `referral_code`, `active`, timestamps.
- `player_referrals`: `id`, `player_id`, `ambassador_id`, `campaign_id`, `referral_code`, `created_at`, with one active attribution per player per campaign.

The referral code should be normalized before lookup, such as trimming, uppercasing, and collapsing unsupported spacing. The exact seeded code values can be supplied later with the ambassador list.

Alternative considered: store only raw referral text on `players`. That would be simpler but would make reporting, validation, and future ambassador deactivation harder.

### Validate referral codes only when provided

The onboarding referral field is optional. Blank referral codes are accepted. A non-empty unknown or inactive referral code should return a clear validation error from session creation and should not create or update player referral attribution.

Alternative considered: silently ignore unknown codes. That would reduce onboarding friction but would make typos hard to detect and would weaken campaign attribution quality.

## Sequence Diagrams

### Onboarding referral capture

```text
Player
  |
  | enters nickname, email, organization, optional referral code
  v
Vue EmailGate/App state
  |
  | stores identity locally and later calls POST /api/sessions
  v
createSession
  |
  | normalize referralCode if present
  v
student_ambassadors lookup
  |
  | valid active code                blank code
  |---------------------.            |
  v                     |            v
upsert/resolve player  |       upsert/resolve player
  |                     |            |
  v                     |            v
insert player_referrals |       no referral row
  |
  v
return session payload and player token
```

### Organization leaderboard with nicknames

```text
GET /api/leaderboard?campaign=APR26
  |
  v
Aggregate progression_scores by organization
  |
  +--> score, contributor count, last scoring timestamp
  |
  v
Aggregate progression_scores by organization + player
  |
  +--> contributor score, contributor last scoring timestamp, nickname
  |
  v
Rank contributors within each organization
  |
  v
Return organization rows with topContributors[0..4]
```

## Risks / Trade-offs

- Nicknames are visible to all players who can view the leaderboard -> Onboarding copy and labels must make nickname visibility clear.
- Top contributor aggregation can make leaderboard queries heavier -> Reuse existing campaign/org indexes where possible and keep the contributor list capped to five rows per organization.
- Existing clients/tests may still use `playerName` -> Keep request compatibility and storage keys stable unless a scoped migration is explicitly needed.
- Referral codes depend on a later ambassador list -> Ship schema and validation against whatever catalog exists; blank codes remain valid until the list is available.
- Unknown-code rejection can block a player who mistypes a code -> Provide a clear error and allow clearing the optional field to continue.

## Migration Plan

1. Add an idempotent SQL migration after the current migration set to create `student_ambassadors` and `player_referrals` with appropriate uniqueness and lookup indexes.
2. Update backend session creation to accept `referralCode`, normalize and validate it when present, and insert attribution only after the player identity is resolved.
3. Update leaderboard aggregation to include top contributor nickname metadata while preserving existing score/rank fields.
4. Update frontend onboarding labels and optional referral-code input, then update leaderboard rendering for top contributor nicknames.
5. Update admin labels and CSV headers from name/player_name presentation to nickname where those are user-visible labels.
6. Add unit and e2e coverage, then deploy backend before frontend so the UI can consume the extended leaderboard shape.

Rollback is frontend-first: hide the referral input and top-contributor nickname column, then stop sending `referralCode`. The backend can continue returning extra leaderboard fields and retaining unused referral tables. Because this change does not rename `players.player_name`, no destructive database rollback is needed.

## Open Questions

- The final Student Ambassador list and exact referral-code values are still pending.
- If two Student Ambassadors have the same display name, the seed/import process must provide distinct referral codes.