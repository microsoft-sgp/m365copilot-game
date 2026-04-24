## Context

The Copilot Chat Bingo game is a Vue 3 + Tailwind CSS single-page application used during Microsoft workshops. Players open the game on phones and laptops in a conference room, multitasking between the game and workshop content. The current UI was built function-first without responsive design consideration. The TopBar contains corporate branding that crowds the game title, the leaderboard is buried below a form, and the layout breaks on phone screens (<600px). This change is frontend-only — no backend, database, or API modifications.

**Current component tree:**
```
App.vue
├── EmailGate (pre-auth landing)
├── TopBar (sticky header: branding + title + stats)
├── AppTabs (horizontal pill tabs)
├── GameTab
│   ├── SetupPanel (name + pack selection)
│   └── BoardPanel
│       ├── ChallengeBar (weekly progress)
│       ├── HudBar (tiles/lines/keywords stats)
│       └── BingoGrid (3×3 tiles)
├── KeywordsPanel (earned keywords list)
├── SubmitPanel (form + LeaderboardTable)
├── HelpPanel (instructions)
├── TileModal (task detail + verification)
├── WinModal (celebration + keyword reveal)
└── ToastMessage (notifications)
```

## Goals / Non-Goals

**Goals:**
- Make the game fully playable on compact screens (<600px) without horizontal overflow or unreadable text
- Move branding out of the TopBar into a footer, making the game title the hero element
- Align typography and spacing with Material Design 3 type scale minimums
- Make the leaderboard the first thing visible on the Submit tab (social fuel for workshops)
- Add game-like feel to tiles, HUD, and modals
- Ensure all interactive elements meet 48dp minimum touch target on mobile

**Non-Goals:**
- Light mode / theme switching — the dark theme stays as the only theme
- Backend API changes or new endpoints
- Database schema modifications
- Changing game mechanics (verification, keyword minting, scoring)
- Adding animations beyond CSS (no JS animation libraries)
- Rewriting the component architecture — existing component boundaries remain
- i18n / localization support

## Decisions

### Decision 1: Tailwind responsive utilities over CSS media queries

**Choice**: Use Tailwind's built-in breakpoint prefixes (`sm:`, `md:`, `lg:`) mapped to M3 window size classes rather than custom `@media` blocks in the CSS file.

**Rationale**: The project already uses Tailwind CSS with `@tailwindcss/vite`. Tailwind's `sm:` (640px) is close enough to M3's compact/medium boundary (600dp) for a web app. Adding custom breakpoints would add complexity without meaningful benefit. The existing codebase already uses `sm:` in a few places (AdminDashboard, SetupPanel).

**Alternatives considered**:
- Custom CSS `@media` blocks: Would fragment responsive logic between Tailwind classes and raw CSS. Rejected.
- CSS Container Queries: Modern but inconsistent browser support in workshop environments. Rejected.

### Decision 2: Bottom navigation on mobile via conditional rendering

**Choice**: Keep the existing `AppTabs` component but render it differently based on screen size. On compact screens, reposition tabs to the bottom of the viewport using `fixed bottom-0` with icon+label layout. On expanded screens, keep the current horizontal tab bar at the top.

**Rationale**: M3 recommends bottom navigation for compact screens. Since the tab list is short (4 items), a bottom bar fits perfectly. Using Tailwind responsive classes (`sm:` prefix) avoids JavaScript-based layout detection. The `matchMedia` approach used in `LeaderboardTable.vue` should be replaced with pure CSS/Tailwind responsive classes.

**Alternatives considered**:
- Scrollable horizontal tabs at the top: Simpler but less ergonomic on phones — top of screen is hard to reach with one hand. Rejected.
- Separate mobile/desktop tab components: Would duplicate logic. Rejected.

### Decision 3: Footer as a new component, rendered in App.vue

**Choice**: Create a new `GameFooter.vue` component rendered in `App.vue` after the content sections. The footer displays two lines of centered text: "Designed by Microsoft Student Ambassadors" and "Powered by Microsoft". It appears in all views (game, email gate) except admin views.

**Rationale**: The footer is a layout concern, not tied to any specific tab. Placing it in `App.vue` ensures consistent placement. It renders below content, above bottom navigation on mobile.

### Decision 4: Leaderboard-first layout in SubmitPanel

**Choice**: Swap the order of the two glass cards in `SubmitPanel.vue` — LeaderboardTable card moves to the top, keyword submission form moves below it. No component extraction needed; just reorder the template blocks.

**Rationale**: In a workshop, the leaderboard drives engagement. Players check the leaderboard far more often than they submit keywords. Putting it first means it's visible without scrolling.

### Decision 5: Responsive bingo grid via Tailwind breakpoints

**Choice**: Change `BingoGrid.vue` from `grid-cols-3` to `grid-cols-2 sm:grid-cols-3`. On compact screens, the 9 tiles render in a 2-column layout (5 rows, last tile centered). On medium+, the familiar 3×3 grid remains.

**Rationale**: On a 375px phone, each tile in a 3-column layout is ~107px wide with 12px gap — too cramped for the task title and tag text. Two columns give ~165px per tile, enough for readable text.

### Decision 6: Full-screen modal on compact

**Choice**: Modify `TileModal.vue` to use Tailwind responsive classes: `w-full h-full sm:max-w-[600px] sm:max-h-[90vh] sm:rounded-[20px]`. On compact, the modal fills the viewport with no border-radius. On expanded, it retains the current centered floating card style. Reduce padding from `p-7` to `p-4 sm:p-7`.

**Rationale**: The current modal at `max-w-[600px] p-7` leaves only ~275px for content on phones, requiring excessive scrolling past the prompt, launch instructions, and proof textarea.

### Decision 7: CSS-only game-like enhancements

**Choice**: Add visual polish using CSS only — no JS animation libraries:
- Tile hover: `scale(1.03)` + glow shadow instead of `translateY(-2px)`
- Unclaimed tiles: Subtle shimmer via CSS `@keyframes` on a pseudo-element
- HudBar motivational text: Computed property in the component based on `boardProgress`
- Progress bar: Color gradient transition (lilac → neon → success)

**Rationale**: Workshop attendees are on varying devices with different performance profiles. CSS animations are GPU-accelerated and won't cause frame drops. No external dependencies needed.

### Decision 8: Retain current `matchMedia` removal approach

**Choice**: Replace the `window.matchMedia('(max-width: 639px)')` call in `LeaderboardTable.vue` with a Vue `ref` + `onMounted`/`onUnmounted` listener, or simply use Tailwind's `hidden sm:table-cell` to show/hide columns responsively.

**Rationale**: The current approach evaluates once at render time and doesn't update on resize. A CSS-based approach is reactive and handles orientation changes automatically.

## Risks / Trade-offs

- **[2-column grid changes bingo geometry]** → Players familiar with 3×3 may find 2-column confusing. Mitigation: Only on compact screens; the grid is still 9 tiles with the same indices. Add visual numbering or a label to clarify layout.
- **[Bottom nav overlaps content]** → Fixed-bottom nav eats ~56px of viewport. Mitigation: Add `pb-16 sm:pb-0` padding to the main content area on compact screens.
- **[Footer adds scroll length]** → Every tab now has footer content below. Mitigation: Footer is minimal (2 lines, ~60px) with top border. Not significant.
- **[Shimmer animation on tiles may feel distracting]** → Mitigation: Use very subtle opacity (0.03-0.05) and slow duration (3s+). Can be tuned without code changes since it's pure CSS.
- **[Breaking existing snapshot/visual tests]** → Multiple component templates will change. Mitigation: Update tests as part of implementation tasks.
