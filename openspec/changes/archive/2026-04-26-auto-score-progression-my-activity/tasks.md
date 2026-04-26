## 1. Data Model and Migration

- [x] 1.1 Add SQL migration(s) for progression scoring records table, idempotency constraints, and leaderboard indexes.
- [x] 1.2 Add migration-safe compatibility handling so existing submissions data remains intact for rollback.
- [x] 1.3 Add/adjust database tests validating idempotent inserts and leaderboard aggregation performance paths.

## 2. Backend Scoring Pipeline

- [x] 2.1 Update event ingestion (`POST /api/events`) to persist score-bearing progression records for line wins and weekly milestones.
- [x] 2.2 Add idempotency guards in backend writes so replayed events do not create duplicate score contributions.
- [x] 2.3 Update leaderboard aggregation (`GET /api/leaderboard`) to read from progression scoring source.
- [x] 2.4 Keep `POST /api/submissions` available behind transition controls but remove it as player scoring dependency.

## 3. Identity and Session API Behavior

- [x] 3.1 Enforce onboarding display name as canonical player name in session creation/upsert flow.
- [x] 3.2 Ensure normal gameplay session calls do not overwrite canonical display name after onboarding.
- [x] 3.3 Add/adjust API tests for fixed display name behavior and progression-based scoring responses.

## 4. Frontend Onboarding and Setup Flow

- [x] 4.1 Update identity gate to collect required email + display name and persist both locally.
- [x] 4.2 Remove name entry from setup panel so board launch is pack-selection-only.
- [x] 4.3 Update help text and in-app copy to reflect progression-based scoring and fixed onboarding identity.

## 5. Frontend Navigation and Activity UX

- [x] 5.1 Replace Submit tab with My Activity tab in desktop and mobile navigation.
- [x] 5.2 Implement My Activity read-only panel showing progression/scoring events and timestamps.
- [x] 5.3 Remove manual keyword submission form and related player-facing controls from game flow.
- [x] 5.4 Keep leaderboard updates immediate after score-bearing progression events.

## 6. Admin and Reporting Alignment

- [x] 6.1 Update admin dashboard queries/response shaping to use progression scoring source.
- [x] 6.2 Update admin CSV export format/query logic to remain consistent with progression-based scoring.
- [x] 6.3 Add parity checks/tests ensuring admin totals and player leaderboard values match.

## 7. Rollout, Compatibility, and Validation

- [x] 7.1 Add feature flag/config path for progression-scoring rollout and submission-path rollback.
- [x] 7.2 Validate migration in staging with parity comparison between legacy and new leaderboard totals.
- [x] 7.3 Execute frontend/backend test suites and targeted smoke tests for onboarding, scoring, activity feed, and admin reporting.
- [x] 7.4 Document cutover and rollback runbook in deployment notes.
