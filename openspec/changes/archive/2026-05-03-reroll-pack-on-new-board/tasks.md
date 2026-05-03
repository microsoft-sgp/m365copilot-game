## 1. Database Lifecycle Schema

- [x] 1.1 Add a numbered SQL migration that allows `pack_assignments.status = 'abandoned'` and adds nullable `abandoned_at` without changing existing `active` or `completed` rows
- [x] 1.2 Update database tests or migration verification notes to cover abandoned status, abandoned timestamp, and absence of any per-player pack blacklist table

## 2. Backend Assignment Lifecycle

- [x] 2.1 Extend pack assignment types and normalization to include abandoned lifecycle fields where needed
- [x] 2.2 Add reroll lifecycle logic that abandons the current active assignment, records `abandoned_at`, and creates one replacement active assignment in a serializable transaction
- [x] 2.3 Update pack selection to prefer avoiding the just-abandoned pack when another campaign-supported pack can be selected, without excluding previously abandoned packs from future draws
- [x] 2.4 Preserve existing first-assignment, incomplete-resume, completion-rotation, and concurrency behavior outside explicit reroll requests
- [x] 2.5 Add Vitest coverage for reroll creation, no permanent blacklist, immediate same-pack avoidance, single-pack fallback, and concurrent active-assignment invariants

## 3. Backend API And Session Guards

- [x] 3.1 Add `POST /api/player/assignment/reroll` with identity validation, player token ownership checks, recovery conflict response, and replacement session response payload
- [x] 3.2 Add stale-session checks so `PATCH /api/sessions/:id` rejects sessions linked to abandoned or completed assignments with `ASSIGNMENT_NOT_ACTIVE`
- [x] 3.3 Add stale-session checks so `POST /api/events` rejects abandoned or completed assignment sessions before inserting tile events or progression scores
- [x] 3.4 Add backend Vitest coverage for reroll endpoint success, missing identity, recovery-required conflict, no-active-assignment fallback, and inactive-assignment update/event rejection

## 4. Frontend Reroll Experience

- [x] 4.1 Add a frontend API helper for the assignment reroll endpoint and typed handling for recovery and assignment-not-active responses
- [x] 4.2 Add composable state logic that calls reroll before clearing local board state, initializes the returned pack/session on success, and preserves the current board on failure
- [x] 4.3 Update `BoardPanel` New Board confirmation copy, loading/error states, and event handling to use the reroll flow
- [x] 4.4 Update setup/status copy so assigned packs are no longer described as locked for the challenge cycle
- [x] 4.5 Add frontend Vitest coverage for successful reroll, declined confirmation, failed reroll preserving current board, local progress reset on success, and updated copy

## 5. Verification

- [x] 5.1 Run backend unit tests with `npm test` from `backend/` and address failures related to this change
- [x] 5.2 Run frontend unit tests with `npm test` from `frontend/` and address failures related to this change
- [x] 5.3 Run or update relevant Playwright coverage for the New Board reroll flow when the full-stack test environment is available
- [x] 5.4 Run `openspec status --change reroll-pack-on-new-board` and confirm the change remains apply-ready
