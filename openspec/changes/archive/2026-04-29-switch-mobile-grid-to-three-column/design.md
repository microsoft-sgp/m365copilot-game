## Context

The bingo board is the focal element of the game. The current responsive layout, introduced in the [2026-04-24-game-ui-redesign](../archive/2026-04-24-game-ui-redesign/design.md) change, switches the grid from 3 columns to 2 columns below the Tailwind `sm:` breakpoint (640px) and centers the orphan 9th tile via `col-span-2 justify-self-center`. While this maximises tile size on phones, it breaks the iconic 3×3 bingo geometry on the device players are most likely to use, and the orphan-centering hack adds visual asymmetry.

Tile content is bounded: titles come from a static `taskBank.js` (24 entries, 11–21 chars, all 2–3 words), so the title length distribution is fully known and not subject to admin-driven growth. Modeling at a 375px viewport showed 22/24 titles wrap cleanly to 1–2 lines in a 3-column compact layout, with one outlier ("Meeting Agenda Maker") wrapping to 3.

## Goals / Non-Goals

**Goals:**

- Render the bingo grid as a 3×3 layout on every supported viewport.
- Eliminate the `i === 8` special-case className from `BingoGrid.vue`.
- Maintain the existing "no horizontal overflow on 375px viewport" guarantee.
- Keep all interactive touch targets ≥48px and all text at or above the M3 minimums (14px body, 11px label).
- Preserve current visual identity (M3 teal, shimmer, hover/focus states) of `.tile`.

**Non-Goals:**

- Changing tile content, copy, or task bank.
- Adjusting any layout other than the bingo grid (TopBar, AppTabs, TileModal, BoardPanel structure all unchanged).
- Adding new breakpoints beyond Tailwind's existing `sm:` (640px).
- Supporting viewports below 320px as a hard guarantee. The defensive `overflow-wrap` is best-effort.

## Decisions

### Decision 1: Single grid class (`grid-cols-3`) rather than responsive column switching

**Choice**: Replace `grid-cols-2 gap-3 sm:grid-cols-3` with a single `grid-cols-3 gap-2 sm:gap-3` class set.

**Rationale**:

- Simplest possible markup; no breakpoint dependency for column count.
- Removes the orphan-centering branch entirely.
- Aligns mobile and desktop bingo geometry.

**Alternatives considered**:

- *Keep responsive 2/3 split* — preserves larger compact tiles but retains the visual asymmetry this change is trying to fix.
- *Use 4 columns on tablet+* — out of scope and would re-introduce orphan tiles (4 cols × 3 rows = 12, not 9).

### Decision 2: Compact-only padding/gap reduction via `sm:` modifiers

**Choice**: Tighten `.tile` to `padding: 10px 8px` and grid `gap-2` (8px) at compact, restore `padding: 14px 12px` and `gap-3` (12px) at `sm:` and above.

**Rationale**:

- At 375px in 3 columns, each tile gets ~106px width. Current 14×12 padding consumes 24px (23%) of width. Dropping to 10×8 padding gives ~90px content area — comfortable for the longest titles ("Stakeholder Email", "Competitive Analysis") and tags ("Decision Making").
- We cannot shrink the title font (`text-body-md` is at the 14px M3 floor mandated by the bingo-frontend spec).
- Padding/gap is the only available horizontal budget lever.

**Alternatives considered**:

- *Drop title to label-md (12px)* — violates the 14px body minimum per `bingo-frontend` spec.
- *Reduce min-height* — does not affect width budget; no benefit.

### Decision 3: Add `overflow-wrap: anywhere` defensively to `.tile`

**Choice**: Add `overflow-wrap: anywhere` to the `.tile` rule in `tailwind.css`.

**Rationale**:

- The longest single word in tile content is "Stakeholder" (11 chars). At 14px bold this is ~88px wide, very close to the ~90px content area on a 375px viewport and exceeds it on a 320px viewport.
- Without `overflow-wrap`, an unbreakable word forces horizontal flex/grid overflow — a regression of the existing "no horizontal overflow" scenario.
- `overflow-wrap: anywhere` allows mid-word breaks only when no other break opportunity exists — visually rare for the current task bank but a guaranteed safety net.

**Alternatives considered**:

- *`word-break: break-all`* — breaks every word eagerly; uglier than `overflow-wrap: anywhere`.
- *No guard, rely on data* — the current data fits, but the defensive class is one CSS line and prevents future content from regressing the layout invariant.

### Decision 4: Single Tailwind `sm:` breakpoint (640px), no custom breakpoints

**Choice**: Continue to use Tailwind's stock `sm:` (640px) as the only breakpoint touching tile padding/gap.

**Rationale**: Matches the project-wide convention used by `mobile-responsive-layout` and avoids introducing per-component breakpoint config.

## Risks / Trade-offs

- **[Smaller compact tiles reduce per-tile readable area]** → Mitigation: compact-only padding/gap reduction recovers ~16px of inner width per tile. Title font stays at 14px; only one of 24 titles wraps to 3 lines.
- **[Reverses prior design decision from 2026-04-24-game-ui-redesign]** → Mitigation: that decision noted the trade-off ("Players familiar with 3×3 may find 2-column confusing"). This change resolves that risk in the opposite direction. Captured in proposal "Why".
- **[Long single words may overflow on viewports <375px]** → Mitigation: `overflow-wrap: anywhere` permits mid-word breaks as a last resort. Spec invariant remains 375px.
- **[Tile heights may vary slightly across the board]** → Mitigation: `min-height: 120px` is preserved; the 1 outlier title that wraps to 3 lines pushes that single tile ~18px taller, which the grid handles via `align-items: stretch` (default) — all tiles in the same row match its height. Visual side effect: row heights vary by row. Acceptable.

## Migration Plan

1. Update `BingoGrid.vue` markup and remove the `i === 8` branch.
2. Add compact-only padding/gap rules and `overflow-wrap` to `.tile` in `tailwind.css`.
3. Update `BingoGrid.test.js` to assert `grid-cols-3` and absence of the previous responsive classes.
4. Update both spec files in lockstep with the implementation.
5. Manual visual check at 320, 375, 414, and 640px viewports before merging.

**Rollback**: Revert the four files. No data, API, or schema changes are involved; rollback is a single git revert.

## Open Questions

_None._ Defaults agreed during exploration: single `sm:` breakpoint, keep 14px body floor, wrap (don't truncate) tag, preserve `min-height: 120px`, add `overflow-wrap` defensively.
