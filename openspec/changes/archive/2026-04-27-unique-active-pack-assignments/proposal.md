## Why

First-time players currently receive a server-assigned pack, but assignment only avoids packs already used by the same player. During a campaign, different active players can still receive the same pack even while unused packs remain, which weakens fairness and variety in onboarding.

## What Changes

- Prefer unique active pack assignments across players within the same active campaign while unused pack ids remain available.
- Allow duplicate active pack assignments only after every campaign-supported pack id is already assigned to at least one active player.
- When duplicates are necessary, distribute overflow fairly by preferring packs with the lowest active assignment count.
- Preserve existing behavior that reuses a player's incomplete active assignment and rotates only after completion.
- Add tests and database support needed to keep assignment resolution safe under concurrent first-time onboarding.
- Rollback plan: revert the assignment selection logic to per-player history avoidance and remove any supporting database migration/index if it causes production issues; existing assignment records remain valid because the schema continues to allow duplicate pack ids.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `pack-assignment-lifecycle`: First assignment and rotation behavior will avoid duplicate active campaign packs until the active pack pool is exhausted, then allow fair duplicate overflow.

## Impact

- Backend: `backend/src/lib/packAssignments.js` assignment selection and related unit tests.
- Database: `pack_assignments` query/index support for active campaign pack counts and concurrency-safe selection.
- APIs: `POST /api/sessions` and `GET /api/player/state` inherit the refined assignment behavior through the existing lifecycle resolver.
- Frontend: no expected UI or API contract change; assigned pack display remains server-authoritative.
- Affected teams: gameplay/product owners for fairness rules, backend maintainers for lifecycle behavior, operations/admins for migration rollout.
