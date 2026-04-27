## Context

The current organization model is already domain based: `organizations` stores leaderboard entities and `org_domains` maps email domains to those entities. The seeded data and frontend fallback map are school centric, and the progression scoring path in `recordEvent` only records an `org_id` when the player's email domain already exists in `org_domains`. Unknown company domains therefore become `UNMAPPED` even though the demo audience may include companies.

Legacy keyword submission can fall back to a manually typed organization, but the current leaderboard source is progression scoring. The new behavior must therefore be backend-owned and shared across session creation, scoring, and legacy submission rather than relying on frontend display logic alone.

## Goals / Non-Goals

**Goals:**

- Resolve company participants to organizations automatically from private/work email domains.
- Keep existing school and admin-managed domain mappings authoritative.
- Support public/free-mail users by asking for an organization without globally mapping shared mail domains.
- Store enough player organization context for score-bearing events to attribute progression scores consistently.
- Keep the existing admin organization management surface as the cleanup path for inferred names and aliases.

**Non-Goals:**

- Integrating an external company enrichment service.
- Perfect legal-company-name detection for every domain suffix.
- Rewriting historical `UNMAPPED` progression scores as part of the first implementation.
- Creating a new admin merge workflow beyond the current rename/domain-management tools.

## Decisions

### Backend resolver is the source of truth

Implement a shared backend organization resolver used by `createSession`, `recordEvent`, and `submitKeyword`. The resolver accepts email plus an optional manually entered organization name and returns an `org_id`, display name, and resolution source.

Alternative considered: frontend-only inference. This was rejected because progression scoring is server-authoritative and `recordEvent` currently decides `progression_scores.org_id`.

### Preserve mapped domains before inferring

Resolution order for non-public domains:

1. Exact `org_domains.domain` match.
2. Inferred company organization and persisted domain mapping.
3. Null only if the email is invalid or the domain cannot be normalized.

Admin-created or seeded mappings therefore override inferred behavior. Inference derives a display name from the domain's organization label, such as `contoso.com` to `Contoso`, while keeping the implementation lightweight and local.

Alternative considered: require admins to preload every company. This was rejected because it makes the demo brittle and high-touch.

### Public/free-mail domains require manual organization context

Maintain a backend-enforced denylist for shared personal mail providers such as `gmail.com`, `outlook.com`, `hotmail.com`, `yahoo.com`, and `icloud.com`. The frontend mirrors this list for immediate UX, but the backend remains authoritative.

For public/free-mail domains, the resolver MUST NOT insert an `org_domains` row. Instead, the onboarding/session payload supplies an organization name, the backend upserts that organization, and the player stores the resulting `org_id`.

Alternative considered: leave public/free-mail users unmapped. This was rejected because demo participants using personal email would not contribute to organization leaderboards. Mapping `gmail.com` globally was rejected because it would corrupt the leaderboard.

### Store player organization attribution

Add nullable `players.org_id` referencing `organizations(id)`. Session creation updates this field when organization resolution succeeds. `recordEvent` uses the player's stored `org_id` for progression scoring, with a fallback resolver for older players whose `org_id` is still null.

Alternative considered: resolve from email on every event only. This was rejected because public/free-mail users cannot be resolved from domain alone and because event recording should not depend on a user-supplied organization in the event payload.

### Keep admin cleanup simple

Inferred organizations and domain mappings appear in the existing admin Organizations view. Admins can rename inferred organizations and add/remove aliases using current endpoints. No new moderation queue is required for the first implementation.

Alternative considered: an approval workflow for inferred companies. This was rejected as unnecessary for the demo and would slow participation.

## Sequence Diagrams

### Private company domain

```text
Player            Frontend          createSession          Org resolver             Database
  | email/name       |                    |                      |                       |
  |----------------->|                    |                      |                       |
  |                  | POST /sessions     |                      |                       |
  |                  |------------------->| resolve email domain |                       |
  |                  |                    |--------------------->| lookup org_domains    |
  |                  |                    |                      |---------------------->|
  |                  |                    |                      | miss                  |
  |                  |                    |                      |<----------------------|
  |                  |                    |                      | upsert Contoso/domain |
  |                  |                    |                      |---------------------->|
  |                  |                    | store players.org_id |                       |
  |                  |                    |----------------------|                       |
  |                  | assigned pack/org  |                      |                       |
  |                  |<-------------------|                      |                       |
```

### Public/free-mail domain

```text
Player            Frontend              createSession          Org resolver          Database
  | gmail email      |                        |                      |                    |
  |----------------->| detect public domain   |                      |                    |
  |                  | ask organization       |                      |                    |
  | organization     |                        |                      |                    |
  |----------------->| POST /sessions         |                      |                    |
  |                  |----------------------->| public domain branch |                    |
  |                  |                        |--------------------->| upsert org only    |
  |                  |                        |                      |------------------->|
  |                  |                        | store players.org_id |                    |
  |                  |<-----------------------|                      |                    |
```

### Progression scoring

```text
Frontend        recordEvent           Database
  | line_won         |                   |
  |----------------->| insert tile event |
  |                  |------------------>| 
  |                  | fetch session/player org_id
  |                  |------------------>| 
  |                  | insert progression_scores.org_id
  |                  |------------------>| 
  | ok               |                   |
  |<-----------------|                   |
```

## Risks / Trade-offs

- Inferred names can be imperfect -> Admins can rename organizations after creation, and explicit domain mappings remain authoritative.
- Public/free-mail manual entries can fragment names -> Normalize whitespace/casing and rely on admin cleanup for true duplicates.
- Concurrent first players from the same company can race on inferred inserts -> Use parameterized upsert/unique-constraint handling and re-read existing rows after conflicts.
- Public suffix parsing can be imperfect without an external library -> Keep inference simple for the demo, seed or admin-map known tricky domains, and avoid an external dependency.
- Existing `UNMAPPED` historical scores remain unchanged -> Treat this as a forward-looking fix unless a later cleanup task explicitly backfills history.

## Migration Plan

1. Add a database migration that creates nullable `players.org_id` with a foreign key to `organizations(id)`.
2. Backfill `players.org_id` where an existing player email domain already maps through `org_domains`.
3. Deploy backend resolver and update session creation/scoring/submission endpoints.
4. Deploy frontend onboarding changes that prompt for organization on public/free-mail domains and send it in session payloads.
5. Admins can review the Organizations view after demos and correct inferred names or aliases.

Rollback: revert frontend/backend behavior while leaving `players.org_id` and inferred organization rows in place. Existing rows are safe to ignore and can be cleaned up manually if needed.

## Open Questions

- None blocking. The initial public/free-mail denylist can be expanded as real demo traffic reveals additional shared providers.