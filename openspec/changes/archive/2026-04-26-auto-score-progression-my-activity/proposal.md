## Why

The current player flow mixes automatic game progress persistence with a manual keyword submission step, which creates duplicated data entry and confusion about what actually drives leaderboard score. We need to align product behavior so verified gameplay progression is the single source of truth for scoring, with onboarding collecting identity once.

## What Changes

- Replace manual keyword submission as the primary scoring mechanism with automatic scoring from verified gameplay events (line wins and weekly progression milestones).
- Replace the player-facing Submit tab with a read-only My Activity surface that shows earned progression events and score contributions.
- Move display name capture to onboarding identity and treat it as fixed after onboarding.
- Keep pack selection as game setup input; remove repeated identity collection in post-onboarding gameplay flows.
- Update leaderboard aggregation to consume progression-derived scoring records rather than explicit user keyword submissions.
- **BREAKING**: Deprecate player-facing reliance on `POST /submissions` for scoring.

## Capabilities

### New Capabilities
- `player-activity-feed`: Read-only player activity history for progression and scoring events.

### Modified Capabilities
- `bingo-frontend`: Remove manual submit UX, update onboarding and game navigation to progression-first flow.
- `game-api`: Add/adjust endpoints and scoring writes so verified gameplay progression updates leaderboard automatically.
- `game-database`: Introduce/update persistence model for progression-derived scoring events and migration away from submission-centric scoring.
- `player-identity`: Capture display name during onboarding and enforce fixed name policy for gameplay session identity.
- `admin-dashboard`: Ensure admin leaderboard/reporting remains correct with progression-based scoring source.

## Impact

- Affected frontend: game onboarding UI, tabs/navigation, submit/keywords/activity surfaces.
- Affected backend: session/event handlers, leaderboard aggregation logic, submission endpoint behavior.
- Affected database: scoring source tables/queries and reporting joins.
- Affected tests: frontend component tests and backend API/database behavior tests.
- Affected teams: Product, Frontend, Backend/API, Data/Analytics, QA.
- Rollback plan: Keep existing submission path behind a feature flag during rollout; if progression-scoring rollout causes scoring regressions, re-enable submission-based aggregation and Submit tab while retaining captured progression events for replay/reconciliation.
