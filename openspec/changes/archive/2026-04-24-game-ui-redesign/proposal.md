## Why

The Bingo game UI was built function-first and feels like a developer tool rather than a fun workshop game. Workshop attendees primarily use phones, but the UI has almost no mobile responsiveness — tables overflow, tabs crush together, modals require excessive scrolling, and the TopBar is unreadable on compact screens. Typography sizes fall below Material Design 3 minimums, touch targets are undersized, and branding ("Powered by Microsoft Student Ambassador") occupies prime TopBar real estate instead of letting the game title shine. The leaderboard — the social engine of workshop engagement — is buried below a form. The result: lower engagement, frustrated mobile users, and a missed opportunity to make the workshop memorable.

## What Changes

- **Move branding to footer**: Remove "Powered by Microsoft Student Ambassador" from TopBar. Add a new footer component: "Designed by Microsoft Student Ambassadors" / "Powered by Microsoft", centered at the bottom of every page.
- **Redesign TopBar as a game header**: Enlarge game title "⚡ COPILOT BINGO" as the hero element. Replace verbose stat labels with compact emoji+number pairs (🔥3 ⭐2 🔑1). Hide non-essential elements on compact screens.
- **Mobile-responsive tab navigation**: Switch tabs to icon+short-label format. Add horizontal scroll or bottom navigation bar pattern on compact screens so all four tabs remain accessible.
- **Responsive bingo grid**: Switch from fixed 3-column to 2-column layout on compact (<600px), 3-column on medium+. Increase tile min-height and font sizes for readability.
- **Full-screen tile modal on mobile**: TileModal goes edge-to-edge on compact screens with reduced padding, eliminating excessive scrolling.
- **Leaderboard prominence**: Flip the Submit tab layout — leaderboard on top, submission form below. Highlight the player's own organization row.
- **M3-aligned typography**: Bump table body text from 13px to 14px (Body Medium), reduce header letter-spacing from 1px to 0.5px, ensure all text meets M3 type scale minimums.
- **Enhanced tile styling**: Add inner glow on hover, subtle scale effect, shimmer on unclaimed tiles to feel more game-like.
- **HudBar gamification**: Add motivational micro-copy that adapts to progress ("Nice start!", "On fire! 🔥", "Almost there!").
- **Streamlined onboarding**: Combine EmailGate and SetupPanel concepts to reduce screens-to-play. Add a decorative mini bingo grid on the landing page.
- **Loading and error states**: Add skeleton loading for leaderboard, error states for API failures, and motivational empty states.

## Capabilities

### New Capabilities
- `game-footer`: Footer component displaying "Designed by Microsoft Student Ambassadors" and "Powered by Microsoft" at the bottom of every view
- `mobile-responsive-layout`: Responsive layout system with M3 window size class breakpoints (compact <600px, medium 600-839px, expanded 840px+) applied across all game components

### Modified Capabilities
- `bingo-frontend`: TopBar redesign (branding removal, game-title hero, compact scores), responsive bingo grid (2-col compact / 3-col expanded), full-screen tile modal on compact, enhanced tile styling, HudBar gamification micro-copy, leaderboard-first submit layout, M3 typography alignment, streamlined onboarding flow, loading/error states

## Impact

- **Frontend components affected**: TopBar, AppTabs, BingoGrid, TileModal, WinModal, HudBar, SubmitPanel, LeaderboardTable, EmailGate, SetupPanel, HelpPanel, App.vue
- **Styles affected**: `frontend/src/styles/tailwind.css` (theme tokens, component utilities, new responsive utilities)
- **No backend changes**: All changes are frontend-only
- **No database changes**: No schema modifications
- **Tests affected**: Component tests for TopBar, BingoGrid, LeaderboardTable, AppTabs, SubmitPanel, EmailGate, SetupPanel, HudBar, and any snapshot/visual tests
- **Rollback plan**: Revert the frontend commits; no data migration or API changes to reverse
- **Affected teams**: Frontend / design; no backend or infrastructure impact
