## Why

Players currently pick packs manually, which enables pack shopping and creates an inconsistent experience across devices. We need a fair and predictable lifecycle where pack assignment is automatic, stable during an active 7-week cycle, and rotated only after completion.

## What Changes

- Replace user-driven pack selection in the player setup flow with server-authoritative automatic assignment.
- Enforce one active pack assignment per player per campaign at a time.
- Keep the assigned pack stable across logins/devices while the 7-week challenge is incomplete.
- When a player reaches 7 of 7 completed weeks for the assigned pack, assign a new pack on the next login/session bootstrap.
- Return assignment metadata to the client so the UI can explain current-cycle status and next-pack progression.
- Add migration-safe persistence and constraints so assignment behavior is deterministic under concurrent logins.
- Add tests for assignment lock, completion-triggered rotation, and cross-device consistency.

## Capabilities

### New Capabilities
- `pack-assignment-lifecycle`: Server-authoritative pack assignment lifecycle with active-lock and completion-based rotation.

### Modified Capabilities
- `bingo-frontend`: Setup and startup behavior changes from manual/quick-pick selection to automatic assignment display and launch.
- `game-api`: Session and player-state behavior changes to enforce assignment lock and next-cycle pack rotation after 7-week completion.
- `game-database`: Schema and constraints extended to persist assignment lifecycle and ensure one active assignment per player/campaign.

## Impact

- Affected frontend code: setup/start board workflow, startup hydration path, and pack-display UX.
- Affected backend code: session creation and player-state retrieval logic, completion detection, and assignment rotation path.
- Affected data model: additional assignment lifecycle fields/table and uniqueness constraints for active assignment.
- Affected tests: frontend startup/session tests and backend session/player-state/database behavior tests.
- Affected teams: frontend, backend/API, QA, analytics/ops.
- Rollback plan: feature-flag or guarded fallback to current behavior (manual pack selection + existing session logic), revert schema usage paths while preserving data, and re-enable legacy startup flow if post-deploy issues appear.
