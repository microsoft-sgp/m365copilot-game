## 1. Database Lifecycle Foundations

- [x] 1.1 Add schema migration(s) for pack assignment lifecycle persistence (active/completed cycles per player+campaign).
- [x] 1.2 Add constraints/indexes that enforce at most one active assignment per player+campaign under concurrency.
- [x] 1.3 Backfill assignment lifecycle records from existing game session history without data loss.
- [x] 1.4 Add/adjust repository queries for resolving active assignment and marking completed assignments.

## 2. API Assignment Resolution and Rotation

- [x] 2.1 Update `POST /api/sessions` to resolve server-authoritative assigned pack and return it in response payload.
- [x] 2.2 Implement completion-aware rotation logic (7/7 weeks complete -> new assignment on next bootstrap).
- [x] 2.3 Update `GET /api/player/state` to return active assignment metadata and perform rotation on completed cycles.
- [x] 2.4 Ensure assignment and session creation paths are transaction-safe for concurrent requests.

## 3. Frontend Setup and Startup Flow

- [x] 3.1 Replace setup pack input/quick-pick UI with assigned-pack display and launch action.
- [x] 3.2 Update startup hydration flow to consume assignment metadata from player-state/session APIs.
- [x] 3.3 Update board start flow to use server-assigned pack while preserving deterministic board generation.
- [x] 3.4 Add user-facing cycle messaging for "active pack" and "new pack assigned after completion" states.

## 4. Tests and Validation

- [x] 4.1 Add backend unit tests for assignment lock, completion-triggered rotation, and concurrent bootstrap behavior.
- [x] 4.2 Add frontend tests for no manual pack chooser, assigned-pack launch, and login-driven rotation UX.
- [x] 4.3 Add integration test coverage for cross-device consistency (same pack while incomplete, new pack after 7/7 completion).
- [x] 4.4 Run existing test suites and smoke checks, then fix regressions introduced by assignment lifecycle changes.

## 5. Rollout and Safety

- [x] 5.1 Introduce feature-flagged rollout path for assignment lifecycle behavior.
- [x] 5.2 Document migration and rollback runbook for ops and QA.
- [x] 5.3 Validate telemetry/logging for assignment creation, completion, and rotation events.
