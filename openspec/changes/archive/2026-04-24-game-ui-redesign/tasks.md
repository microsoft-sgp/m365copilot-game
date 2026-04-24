## 1. Theme and Typography Foundation

- [x] 1.1 Update `tailwind.css` typography: bump table body text from `13px` to `14px`, reduce header `tracking` from `1px` to `0.5px`, verify all text meets M3 Body Medium / Label Small minimums
- [x] 1.2 Add tile shimmer `@keyframes` animation to `tailwind.css` (slow, low-opacity pseudo-element shimmer on `.tile:not(.cleared)`)
- [x] 1.3 Update `.tile:hover` from `translateY(-2px)` to `scale(1.03)` with glow shadow effect in `tailwind.css`

## 2. TopBar Redesign

- [x] 2.1 Remove branding text ("Powered by Microsoft Student Ambassador") from `TopBar.vue`
- [x] 2.2 Enlarge game title "⚡ COPILOT BINGO" as hero element (increase font size, keep `text-gradient`)
- [x] 2.3 Replace verbose stat labels with compact emoji+number pairs (🔥 tiles, ⭐ lines, 🔑 keys)
- [x] 2.4 Add Tailwind responsive classes to hide stats labels on compact and show game title prominently

## 3. Footer Component

- [x] 3.1 Create `GameFooter.vue` component with "Designed by Microsoft Student Ambassadors" and "Powered by Microsoft" centered text
- [x] 3.2 Add `GameFooter` to `App.vue` template — visible on EmailGate and game views, hidden on admin views
- [x] 3.3 Style footer with subtle top border, muted text, appropriate spacing below content and above bottom nav safe area

## 4. Tab Navigation Responsive Redesign

- [x] 4.1 Refactor `AppTabs.vue` to use icon+short-label layout with responsive positioning: fixed bottom bar on compact (`<sm:`), horizontal top bar on expanded (`sm:`)
- [x] 4.2 Add bottom padding to content sections in `App.vue` on compact screens (`pb-16 sm:pb-0`) to prevent bottom-nav overlap
- [x] 4.3 Ensure tab buttons meet 48px minimum touch target on compact screens
- [x] 4.4 Update `AppTabs.test.js` for new responsive template structure

## 5. Responsive Bingo Grid

- [x] 5.1 Change `BingoGrid.vue` grid from `grid-cols-3` to `grid-cols-2 sm:grid-cols-3`
- [x] 5.2 Center the 9th tile in the last row on 2-column layout (e.g., `col-span-2 sm:col-span-1` with centering or `justify-self-center`)
- [x] 5.3 Update `BingoGrid.test.js` for responsive grid classes

## 6. Full-Screen Tile Modal on Compact

- [x] 6.1 Update `TileModal.vue` modal container: full viewport on compact (`w-full h-full rounded-none p-4`), centered card on expanded (`sm:max-w-[600px] sm:max-h-[90vh] sm:rounded-[20px] sm:p-7`)
- [x] 6.2 Ensure the close button and verify button remain easily accessible on both compact and expanded layouts

## 7. HudBar Gamification

- [x] 7.1 Add a computed motivational message to `HudBar.vue` based on `boardProgress` (0%: starter, 1-33%: encouragement, 34-66%: momentum, 67-99%: almost there, 100%: celebration)
- [x] 7.2 Display the motivational message below the progress bar in `HudBar.vue`
- [x] 7.3 Update `HudBar.test.js` for motivational message rendering

## 8. Leaderboard and Submit Panel

- [x] 8.1 Swap order in `SubmitPanel.vue`: move LeaderboardTable glass card above the keyword submission form card
- [x] 8.2 Add player organization highlighting in `LeaderboardTable.vue` — accept detected org as prop or inject, highlight matching row with distinct border/background
- [x] 8.3 Add loading skeleton to `LeaderboardTable.vue` — show shimmer placeholder rows when data is being fetched
- [x] 8.4 Add error state to `LeaderboardTable.vue` — display retry message when API call fails
- [x] 8.5 Update `LeaderboardTable.vue` body text from `text-[13px]` to `text-[14px]` and header tracking from `tracking-[1px]` to `tracking-[0.5px]`
- [x] 8.6 Replace `matchMedia` date formatting with Tailwind responsive column visibility (hide "Last Submission" column on compact or use short format via CSS)
- [x] 8.7 Update `LeaderboardTable.test.js` and `SubmitPanel.test.js` for layout and state changes

## 9. Help Panel Cleanup

- [x] 9.1 Remove "Browser Security Note" (`hint-warn`) block from `HelpPanel.vue`
- [x] 9.2 Remove "Keyword Security Note (Prototype)" (`hint-soft`) block from `HelpPanel.vue`
- [x] 9.3 Remove COPILOT_URL configuration section from `HelpPanel.vue`
- [x] 9.4 Update `HelpPanel.test.js` if applicable

## 10. Final Integration and Testing

- [x] 10.1 Verify no horizontal overflow on 375px viewport across all tabs (EmailGate, SetupPanel, BoardPanel, SubmitPanel, KeywordsPanel, HelpPanel)
- [x] 10.2 Verify footer renders correctly on all game views and is hidden on admin views
- [x] 10.3 Run `npm test` in frontend — fix any broken unit tests from template changes
- [x] 10.4 Visual spot-check on compact (phone) and expanded (desktop) viewports for all components
