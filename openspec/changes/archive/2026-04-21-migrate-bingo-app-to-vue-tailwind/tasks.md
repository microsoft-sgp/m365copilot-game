## 1. Frontend scaffold

- [x] 1.1 Create the Vue 3 frontend application under `frontend/` with the expected build entry points
- [x] 1.2 Configure Tailwind CSS and add `tailwind.css` as the primary global stylesheet entry for the frontend
- [x] 1.3 Add the initial application shell and wire the frontend bootstrap to render the main game experience

## 2. Core game logic extraction

- [x] 2.1 Extract constants, task bank data, line definitions, and organization mapping from the legacy page into frontend modules
- [x] 2.2 Extract deterministic pack generation, keyword minting, and verification helpers into reusable logic modules
- [x] 2.3 Extract browser storage helpers for game state, player profile, and submissions while preserving current persisted behavior

## 3. Reactive game experience

- [x] 3.1 Implement the setup flow in Vue for player name entry, pack selection, and quick pick
- [x] 3.2 Implement the reactive board, HUD, and challenge progress views with deterministic tile rendering
- [x] 3.3 Implement tile modal, prompt copy flow, proof verification, and win feedback in Vue components
- [x] 3.4 Implement keyword history, submission form, organization detection, and leaderboard rendering in the migrated frontend

## 4. Styling and parity validation

- [x] 4.1 Recreate the current visual system using Tailwind utilities and shared rules in `tailwind.css`
- [x] 4.2 Validate responsive behavior for setup, board, modal, and submission views on narrow viewports
- [x] 4.3 Verify parity for board generation, verification outcomes, keyword minting, weekly progress, local persistence, and duplicate submission handling

## 5. Cutover and fallback

- [x] 5.1 Decide and implement how the root entry point serves or links to the new frontend without losing rollback capability
- [x] 5.2 Keep the legacy single-file page available as a fallback until the migrated frontend is confirmed stable