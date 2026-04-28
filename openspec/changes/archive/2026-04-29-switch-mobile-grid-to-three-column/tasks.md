## 1. Component changes

- [x] 1.1 In `frontend/src/components/BingoGrid.vue`, replace the grid container class `mb-[18px] grid grid-cols-2 gap-3 sm:grid-cols-3` with `mb-[18px] grid grid-cols-3 gap-2 sm:gap-3`
- [x] 1.2 Remove the `'col-span-2 justify-self-center sm:col-span-1 sm:justify-self-auto': i === 8` entry from the tile `:class` binding (the `cleared` class binding stays)

## 2. Stylesheet changes

- [x] 2.1 In `frontend/src/styles/tailwind.css`, update the `.tile` rule so compact (default) padding is `10px 8px` and the `sm:` variant restores `14px 12px` (use a media query at `min-width: 640px` consistent with how other compact-only rules in this file are written)
- [x] 2.2 Add `overflow-wrap: anywhere;` to the `.tile` rule as a defensive guard against long single-word titles forcing horizontal overflow

## 3. Unit test updates

- [x] 3.1 In `frontend/src/components/BingoGrid.test.js`, update the "uses responsive grid columns" test: rename to reflect a single 3-column layout, assert `grid-cols-3` is present, and assert that neither `grid-cols-2` nor `sm:grid-cols-3` are present
- [x] 3.2 Run `npm --prefix frontend run test -- BingoGrid` and confirm all assertions pass

## 4. Verification

- [x] 4.1 Run `npm --prefix frontend run test` and confirm the full Vitest suite stays green
- [x] 4.2 Run `npm --prefix frontend run lint` and confirm no new lint warnings or errors
- [x] 4.3 Manually verify the bingo grid in a browser at viewport widths 320px, 375px, 414px, and 640px — confirm 3 columns render, no horizontal scrollbar appears at 375px+, the longest tiles ("Stakeholder Email", "Competitive Analysis") do not clip, and the cleared/hover/focus states on `.tile` still render correctly
- [x] 4.4 Run `openspec validate switch-mobile-grid-to-three-column --strict` and confirm the change validates cleanly
