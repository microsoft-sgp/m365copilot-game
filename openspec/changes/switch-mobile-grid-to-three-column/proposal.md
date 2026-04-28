## Why

The current responsive bingo grid renders 2 columns on compact screens (<640px), reverting to a 5-row layout with the 9th tile centered as an orphan. This breaks the canonical 3×3 "bingo" geometry that players associate with the game and produces an asymmetric layout that requires a special-case `i === 8` className. Switching to 3 columns on all viewports restores the iconic 3×3 grid on mobile, simplifies the component, and matches the visual identity of bingo across every device size.

## What Changes

- **BREAKING (visual)**: Bingo grid renders 3 columns on all screen sizes. Compact (<640px) no longer uses a 2-column layout.
- Remove the `i === 8` orphan-centering logic from `BingoGrid.vue` (no longer needed in a clean 3×3).
- Tighten compact-only tile padding and gap to fit three tiles across a 375px viewport without horizontal overflow.
- Add `overflow-wrap: anywhere` to `.tile` as a defensive guard for long single-word titles (e.g., "Stakeholder", "Competitive") on narrow viewports.
- Update unit tests in `BingoGrid.test.js` to assert the new single-breakpoint grid class set.
- Update both spec files that reference the 2-column layout.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `mobile-responsive-layout`: Replace the "Bingo grid adapts columns to screen width" requirement with one mandating 3 columns at all sizes; remove the "9th tile centered" scenario.
- `bingo-frontend`: Update the "Responsive layout remains usable on smaller screens" scenario to remove the "2-column grid" wording.

## Impact

- **Code**: `frontend/src/components/BingoGrid.vue`, `frontend/src/components/BingoGrid.test.js`, `frontend/src/styles/tailwind.css` (compact `.tile` overrides + `overflow-wrap`).
- **Specs**: `openspec/specs/mobile-responsive-layout/spec.md`, `openspec/specs/bingo-frontend/spec.md`.
- **Tests**: One unit test assertion changes (BingoGrid grid-class assertion). No e2e changes expected — `player-flow.spec.ts` looks up tiles by accessible text, not grid position.
- **APIs / database / dependencies**: None.
- **Affected teams**: Frontend only. No backend, infra, or data work.
- **Rollback plan**: Revert the four files above (component, test, stylesheet, both specs). No data migrations, no API changes, no feature flags required. A git revert of the change commit fully restores the previous 2-column compact behavior.
