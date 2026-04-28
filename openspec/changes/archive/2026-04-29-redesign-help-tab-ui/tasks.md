## 1. HelpPanel Redesign

- [x] 1.1 Replace the existing ordered-list HelpPanel body with a scannable play-loop layout organized into Start, Play, Claim, and Track progress sections.
- [x] 1.2 Preserve all essential instruction content: onboarding, assigned pack launch, tile prompt use, Copilot Chat usage, proof verification, Bingo line keyword earning, and activity tracking.
- [x] 1.3 Promote the Open Copilot Chat link as the primary action while keeping Admin Login as a secondary action.
- [x] 1.4 Preserve the existing `COPILOT_URL` link behavior, safe external-link attributes, and `admin` event emission.
- [x] 1.5 Use existing Tailwind/M3 primitives and named typography tokens so the layout remains responsive without horizontal overflow on compact screens.

## 2. Test Coverage

- [x] 2.1 Update `HelpPanel.test.js` to assert the How to Play heading and Start, Play, Claim, and Track progress sections instead of the old ordered-list count.
- [x] 2.2 Update tests to verify the redesigned panel still includes the required gameplay instruction topics.
- [x] 2.3 Keep or update tests verifying the Copilot Chat link uses `COPILOT_URL`, Admin Login emits `admin`, and developer-facing notes remain hidden.

## 3. Verification

- [x] 3.1 Run the frontend Vitest suite with `npm test` from `frontend/` and address regressions related to this change.
- [x] 3.2 Manually review the Help tab at compact and expanded widths to confirm readable layout, visible actions, and no content hidden behind navigation.