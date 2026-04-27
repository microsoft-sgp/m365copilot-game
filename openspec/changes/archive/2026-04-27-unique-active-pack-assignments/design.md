## Context

Pack assignment is already server-authoritative. `resolvePackAssignment` runs inside a SQL transaction, reuses an incomplete active assignment, and creates a new active assignment when a player has no assignment or rotates after completion.

The current selection logic avoids packs from the same player's previous sessions, but it does not look at active assignments for other players in the campaign. The database enforces one active assignment per player and campaign, while still allowing multiple players to share a pack id. That schema shape is useful because duplicate pack ids must remain possible once the active player count exceeds the campaign pack count.

Current creation flow:

```text
POST /api/sessions or GET /api/player/state
        │
        ▼
resolvePackAssignment(player, campaign)
        │
        ├─ existing incomplete active assignment? ──▶ return it
        │
        ├─ completed active assignment? ───────────▶ mark completed
        │
        ▼
choose next pack and insert active assignment
```

## Goals / Non-Goals

**Goals:**
- Keep one active assignment per player and campaign.
- Give different active players different pack ids while unused campaign pack ids remain.
- Allow duplicate active pack ids after every campaign-supported pack id is already represented by at least one active assignment.
- Spread overflow duplicates across the least-used active pack ids.
- Preserve existing API response shapes and frontend behavior.
- Keep rotation behavior completion-based.

**Non-Goals:**
- Do not make pack ids globally unique forever.
- Do not block onboarding when more active players exist than campaign packs.
- Do not add a frontend pack picker or expose allocation internals to players.
- Do not change keyword format, pack generation, or campaign configuration semantics.

## Decisions

### Serialize assignment creation per campaign

Assignment creation and rotation should acquire a transaction-owned SQL application lock scoped to the campaign before reading active pack counts and inserting a new assignment.

```text
Transaction begins
        │
        ▼
sp_getapplock('pack-assignment:<campaignId>', Exclusive, Transaction)
        │
        ▼
read active pack counts
        │
        ▼
choose pack
        │
        ▼
insert assignment
        │
        ▼
commit releases lock
```

Rationale: a filtered unique index on `(campaign_id, pack_id)` cannot represent the overflow rule, because duplicates become valid after exhaustion. An application lock keeps the check-and-insert decision atomic without introducing a separate pack inventory table.

Alternative considered: rely on `SERIALIZABLE` plus `UPDLOCK, HOLDLOCK` over `pack_assignments`. That protects existing rows, but it is easy to miss absent pack ids because they are not rows yet. A campaign-scoped application lock is clearer and easier to reason about.

### Select from active assignment counts, not player history

When creating a new assignment, the resolver should derive pack availability from active `pack_assignments` for the campaign:

- If any pack id from `1..totalPacks` has zero active assignments, choose randomly from those zero-count pack ids.
- If all pack ids have at least one active assignment, find the minimum active assignment count and choose randomly from pack ids with that count.

Rationale: the product goal is fairness across active players. Completed assignments remain historical records and should not permanently consume a pack id.

Alternative considered: preserve the current per-player history avoidance. That prevents an individual player from repeating a pack, but it does not satisfy the new fairness requirement for first-time onboarding.

### Keep schema duplicate-friendly, add supporting index only

The schema should not add a uniqueness constraint on `pack_id` per campaign. If performance needs support, add a filtered or composite non-unique index that helps count active assignments by campaign/status/pack.

Rationale: duplicate active assignments are allowed once active players exceed `totalPacks`. A unique constraint would turn the overflow rule into a runtime failure.

Alternative considered: maintain a separate allocation table with one row per pack and count columns. That may be useful later if campaigns grow much larger, but it adds operational complexity that is not needed for 999 packs.

## Risks / Trade-offs

- Campaign-scoped lock reduces assignment concurrency -> Mitigation: only assignment creation/rotation is serialized; existing assignment reuse remains fast and the critical section is small.
- Overflow fairness depends on accurate active status -> Mitigation: rotation must mark completed assignments before counting active packs for the next assignment.
- Querying all active pack counts could become expensive for large campaigns -> Mitigation: add a targeted non-unique index and keep `totalPacks` bounded by campaign configuration.
- Existing active duplicate assignments may already exist before deployment -> Mitigation: the new logic does not require cleanup; it avoids additional duplicates while zero-count packs remain after deployment.

## Migration Plan

1. Add a database migration for any supporting non-unique index on active pack assignment lookup/counting.
2. Update assignment resolution to acquire the campaign-scoped application lock before selecting a new pack.
3. Replace per-player used-pack selection with campaign active-count selection.
4. Add unit tests for unique active assignment, overflow duplicate balancing, existing-assignment reuse, rotation, and transaction rollback.
5. Deploy backend and migration together; no frontend deployment is required for behavior correctness.

Rollback: revert the resolver to the prior per-player selection logic and drop the supporting index if necessary. Existing assignment records remain compatible because no restrictive uniqueness constraint is introduced.

## Open Questions

- Should completed players who rotate back into a campaign avoid their own immediately previous pack when zero-count active packs exist? The current requirement prioritizes active campaign uniqueness, not personal history.
