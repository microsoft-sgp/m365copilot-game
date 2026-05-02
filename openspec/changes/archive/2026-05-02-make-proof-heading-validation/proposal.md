## Why

Players can produce structurally correct Copilot proof that uses plain section labels instead of Markdown `##` headings, causing otherwise valid tile completions to be rejected. This creates avoidable friction during live gameplay because the validator is stricter about heading syntax than the learning task outcome requires.

## What Changes

- Allow heading-based proof rules to recognize plain section-label lines in addition to Markdown `##` headings.
- Keep existing Markdown heading support so current prompts and accepted proofs remain valid.
- Improve validation coverage around heading matching to document accepted and rejected forms.
- Do not change backend APIs, board generation, scoring, or keyword minting behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bingo-frontend`: Proof verification for heading-based tasks accepts plain section labels as valid headings when they match the required heading text.

## Impact

- Affected code: `frontend/src/lib/verification.ts` and related unit tests.
- Affected teams: event facilitators and frontend maintainers.
- APIs and data: no backend API, database, or persisted-state schema changes.
- Dependencies: no new dependencies expected.
- Rollback plan: restore the heading validator to require `##` prefixes only and revert the associated unit-test expectations.