## 1. Database Migration

- [x] 1.1 Add a numbered SQL migration that creates nullable `players.org_id` with a foreign key to `organizations(id)`.
- [x] 1.2 Backfill `players.org_id` from existing `org_domains` mappings for players with mapped email domains.
- [x] 1.3 Ensure the migration preserves existing players and historical `progression_scores` rows with null `org_id`.

## 2. Backend Organization Resolver

- [x] 2.1 Create a shared backend organization resolver module for email normalization, domain extraction, public/free-mail detection, and organization resolution.
- [x] 2.2 Implement exact domain lookup so seeded and admin-managed `org_domains` mappings remain authoritative.
- [x] 2.3 Implement non-public company-domain inference that upserts an organization and domain mapping, handling unique-constraint races by re-reading existing rows.
- [x] 2.4 Implement public/free-mail resolution that requires a supplied organization name, upserts the organization, and never creates an `org_domains` row for the shared mail domain.
- [x] 2.5 Add backend unit tests for mapped domains, inferred company domains, public/free-mail domains, missing public-email organization names, and concurrent duplicate handling.

## 3. Backend API Integration

- [x] 3.1 Update `POST /api/sessions` to accept optional organization name, resolve organization during player upsert, and store `players.org_id`.
- [x] 3.2 Update `GET /api/player/state` to return stored organization context needed by returning public-email players.
- [x] 3.3 Update `POST /api/events` scoring inserts to use the player's stored organization and fall back through the resolver for older players with null `org_id`.
- [x] 3.4 Update `POST /api/submissions` to use the shared resolver and return messages using the resolved organization name.
- [x] 3.5 Update public organization-domain map tests to cover inferred non-public mappings and public/free-mail exclusions.

## 4. Frontend Identity Flow

- [x] 4.1 Add frontend public/free-mail domain detection for onboarding UX, mirroring the backend-enforced denylist.
- [x] 4.2 Update the email gate to show and require an organization field only for public/free-mail domains.
- [x] 4.3 Persist the organization name in localStorage for public/free-mail identities and hydrate it into game state.
- [x] 4.4 Include stored organization name in session creation payloads.
- [x] 4.5 Add frontend tests for private company email onboarding, public/free-mail organization prompting, validation, persistence, and session payloads.

## 5. Admin And Leaderboard Behavior

- [x] 5.1 Verify inferred organizations and inferred non-public domain mappings appear in the existing admin Organizations view.
- [x] 5.2 Verify admin renames of inferred organizations are reflected in leaderboard and organization list responses.
- [x] 5.3 Verify public/free-mail users score under their selected organization without adding shared mail domains to the public domain map.

## 6. Verification

- [x] 6.1 Run backend unit tests for organization resolution, session creation, event scoring, submission, and public config behavior.
- [x] 6.2 Run frontend unit tests for onboarding and session payload behavior.
- [x] 6.3 Run `openspec validate infer-organizations-from-email-domain --strict` and fix any artifact issues.
- [x] 6.4 Run final formatting or lint checks required by the touched backend/frontend files.