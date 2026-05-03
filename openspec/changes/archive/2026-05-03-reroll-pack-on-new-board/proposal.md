## Why

Players expect the New Board action to produce a fresh board. Today it only clears local board state and then reuses the same server-assigned pack while the assignment is incomplete, which makes the action feel broken for a replayable game experience.

## What Changes

- Change New Board from a local reset into a server-authoritative pack reroll that abandons the current active assignment and assigns a fresh active pack.
- Add an `abandoned` assignment lifecycle state for user-initiated rerolls. Abandoned assignments remain historical records and do not imply completion.
- Prevent abandoned game sessions from accepting future progress or scoring events once a replacement assignment becomes active.
- Keep abandoned packs eligible for the same player in future assignments; do not create a permanent per-user blacklist.
- Prefer avoiding the just-abandoned pack for the immediate next assignment when another campaign-supported pack is available.
- Update frontend copy and launch behavior so players understand New Board clears current progress and assigns a new pack.
- Preserve existing first-assignment, incomplete-resume, and completion-based rotation behavior outside the explicit New Board reroll path.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `pack-assignment-lifecycle`: Add user-initiated abandonment and reroll semantics while preserving one active assignment per player campaign.
- `game-api`: Add API behavior for replacing the active assignment and rejecting progress/events for abandoned assignment sessions.
- `game-database`: Extend assignment lifecycle persistence to record abandoned assignments without blacklisting packs.
- `bingo-frontend`: Change New Board UX from local reset to server-backed assignment reroll with updated copy and state handling.

## Impact

- Frontend: `BoardPanel`, `SetupPanel`, `useBingoGame`, API client helpers, and related unit/e2e tests.
- Backend: session/assignment lifecycle helpers, session creation or a new reroll endpoint, session update/event authorization checks, and tests.
- Database: migration to allow `pack_assignments.status = 'abandoned'` and any indexes/queries that assume only `active` or `completed`.
- Observability: existing Sentry/API failure handling should cover the new API path; add structured backend logging for assignment abandonment/reroll outcomes if consistent with current lifecycle logs.
- Affected teams: gameplay/frontend owner, backend/API owner, database/infra owner, and admin/analytics stakeholders who consume assignment history.
- Rollback plan: hide or revert the New Board reroll call in the frontend so the button returns to local reset behavior, keep the database status extension as a backward-compatible schema change, and continue treating existing active/completed assignments under the prior lifecycle rules.
