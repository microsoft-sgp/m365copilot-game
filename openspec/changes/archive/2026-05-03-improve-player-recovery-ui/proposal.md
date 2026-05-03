## Why

The Player Recovery section currently renders recovery actions with weak visual affordance on mobile, making the primary path hard to identify and easy to miss. Improving this flow now reduces recovery friction for players who need to reclaim an existing board from a new browser or device.

## What Changes

- Present Player Recovery as a focused, calm recovery step rather than an error-style card.
- Make the primary recovery action visually unmistakable on compact screens, with a clear secondary path to use a different email.
- Clarify the copy around the recovery email, code delivery, and code-entry step while preserving existing recovery semantics.
- Use existing design-system form and button patterns for recovery actions, code input, status, errors, and disabled states.
- Keep Launch Board visible but clearly unavailable while recovery is required.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `player-identity`: Player recovery UI presentation and action hierarchy will be tightened so players can clearly send a recovery code, enter a code only after successful request, verify recovery, or choose a different email.

## Impact

- Affected code: `frontend/src/components/SetupPanel.vue`, shared button/input styling in `frontend/src/styles/tailwind.css`, and frontend tests for the setup/recovery flow.
- Affected APIs: none; existing `POST /api/player/recovery/request` and `POST /api/player/recovery/verify` behavior is unchanged.
- Affected teams: frontend/game experience owners, player identity/auth owners, and QA covering mobile recovery flows.
- Rollback plan: revert the SetupPanel and shared style changes to restore the existing recovery layout without database, API, or infrastructure rollback.