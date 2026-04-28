## Why

The Help tab currently presents the game flow as a dense ordered list, which makes it feel more like documentation than part of the playable experience. Redesigning it as a compact, scannable play-loop guide will help players understand what to do next while preserving the existing Copilot Chat and admin access actions.

## What Changes

- Replace the single long instructional list with a player-focused HelpPanel organized around the core play loop: start, play, claim, and track progress.
- Promote the Copilot Chat action as the primary external action while keeping Admin Login available as a secondary action.
- Keep HelpPanel content player-relevant and avoid developer-facing notes, configuration details, or prototype warnings.
- Preserve responsive behavior so the redesigned Help tab remains readable and tappable on compact and expanded viewports.
- Preserve existing events and links: Copilot Chat opens `COPILOT_URL`; Admin Login emits the existing admin navigation event.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bingo-frontend`: Updates HelpPanel requirements from a numbered how-to list to a scannable play-loop guide with preserved player actions and responsive presentation.

## Impact

- Affected code: `frontend/src/components/HelpPanel.vue`, `frontend/src/components/HelpPanel.test.js`, and optionally existing Playwright coverage if visual or responsive assertions are added.
- APIs: None.
- Dependencies: None.
- Systems: Frontend-only player game shell.
- Affected teams: Frontend/game experience owners and event administrators who rely on Admin Login access from player-facing entry points.
- Rollback plan: Revert the HelpPanel component and associated tests to the previous ordered-list implementation; no data or API rollback is required.