## Why

The demo game currently recognizes only pre-seeded school domains, so players from companies often appear as `UNMAPPED` on the progression-based leaderboard. Expanding organization resolution to company email domains makes the demo usable for mixed school and workplace audiences without requiring admins to pre-load every participating company.

## What Changes

- Infer an organization from non-public email domains when no explicit domain mapping exists, then persist the inferred organization and domain mapping for future players.
- Require or capture a manually entered organization for public/free-mail domains such as Gmail, Outlook, Yahoo, and iCloud without mapping those shared domains globally.
- Reuse the same organization resolution behavior for progression scoring and legacy keyword submissions so leaderboard attribution is consistent.
- Preserve existing school/MOE domain mappings as authoritative overrides.
- Keep the existing admin organization management surface as the correction layer for renaming inferred organizations and managing domain aliases.
- No breaking changes to public API routes are expected.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `org-management`: Organization/domain mapping behavior now includes inferred company mappings and explicit handling for public/free-mail domains.
- `player-identity`: Player onboarding captures organization when the email domain cannot identify a unique organization automatically.
- `game-api`: Event scoring and keyword submission resolve organizations consistently from mapped domains, manually supplied organizations, or inferred company domains.
- `game-database`: Player/session data model stores enough organization context to score public/free-mail users without globally mapping shared mail domains.

## Impact

- Backend Azure Functions: shared organization resolver, `recordEvent`, `createSession`, `getPlayerState`, and `submitKeyword`.
- Frontend Vue app: email gate/onboarding, local identity persistence, session creation payloads, and any organization detection copy.
- Database: migration for storing a player's selected organization or equivalent organization reference for public/free-mail users.
- Tests: backend resolver/API tests and frontend onboarding/detection tests.
- Affected teams: game/product owner, demo operators/admins, and deployment/database maintainers.

## Rollback Plan

- Disable inferred organization creation by reverting the resolver change and frontend organization prompt behavior.
- Preserve existing `organizations` and `org_domains` rows; inferred rows can remain harmless or be cleaned up by admins if needed.
- If a database column is added for selected organization context, leave it unused during rollback rather than dropping it immediately.