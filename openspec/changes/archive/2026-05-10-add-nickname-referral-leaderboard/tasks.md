## 1. Database And Referral Model

- [x] 1.1 Add an idempotent `012-student-ambassador-referrals.sql` migration for `student_ambassadors` and `player_referrals`, including campaign/code uniqueness, active-code lookup indexes, player/campaign attribution uniqueness, and foreign keys.
- [x] 1.2 Update migration documentation or script references if needed so local/dev database initialization applies the new referral migration in order.

## 2. Backend Referral Handling

- [x] 2.1 Add a backend referral helper to normalize referral codes, look up active Student Ambassador codes for the campaign, and persist player attribution without replacing existing player/campaign attribution.
- [x] 2.2 Extend `POST /api/sessions` request handling to accept optional `referralCode`, validate non-empty codes before successful session creation completes, and store attribution after the player ID is resolved.
- [x] 2.3 Add co-located Vitest coverage for blank referral code, valid referral attribution, invalid/inactive referral rejection, and preservation of existing attribution.

## 3. Backend Leaderboard Nicknames

- [x] 3.1 Extend `GET /api/leaderboard` aggregation to return `topContributors` and `hiddenContributorCount` while preserving existing organization `rank`, `org`, `score`, `contributors`, and `lastSubmission` fields.
- [x] 3.2 Rank top contributors by per-organization contribution count descending, most recent contribution descending, and nickname ascending, capped at five contributors per organization.
- [x] 3.3 Keep the legacy `LEADERBOARD_SOURCE=submissions` path compatible, either by returning equivalent contributor metadata from submissions or by returning empty contributor metadata without breaking existing rows.
- [x] 3.4 Add co-located Vitest coverage for top-five contributor ordering, overflow count, no-score responses, and cache payload shape.

## 4. Frontend Onboarding And Leaderboard UI

- [x] 4.1 Update onboarding copy and validation from name/display name to nickname, add optional referral-code input, and persist the referral code under a dedicated storage key.
- [x] 4.2 Update identity/session bootstrap flows to include stored `referralCode` in `POST /api/sessions`, clear it on identity reset, and surface invalid referral-code errors so players can edit or clear the optional field.
- [x] 4.3 Update leaderboard types and rendering to show top contributor nicknames in organization rows with compact `+N` overflow display while preserving score and contributor columns.
- [x] 4.4 Add co-located Vitest coverage for onboarding nickname/referral behavior, session payload propagation, and leaderboard top-contributor rendering.

## 5. Admin Terminology And Reporting

- [x] 5.1 Update admin player management, dashboard tables, and search placeholder labels from name/player to nickname where the UI is presenting player identity.
- [x] 5.2 Update CSV export headers to use `nickname` for player identity while continuing to source values from `players.player_name`.
- [x] 5.3 Add or update co-located Vitest coverage for admin player search labels, dashboard nickname labels, and export CSV headers.

## 6. Verification

- [x] 6.1 Run `npm test` in `backend/` and fix failures caused by this change.
- [x] 6.2 Run `npm test` in `frontend/` and fix failures caused by this change.
- [x] 6.3 Run targeted Playwright coverage for onboarding and leaderboard display if affected e2e fixtures need updates.
- [x] 6.4 Run `openspec validate "add-nickname-referral-leaderboard" --strict` and fix any artifact validation issues.