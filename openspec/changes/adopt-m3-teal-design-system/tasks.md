## 1. Theme Token System

- [x] 1.1 Rewrite `@theme` block in `frontend/src/styles/tailwind.css` — replace all 14 ad-hoc color tokens with M3 dark scheme roles (primary, on-primary, surface, on-surface, outline-variant, etc.) using the teal seed palette from design.md Decision 2
- [x] 1.2 Add named typography scale tokens to `@theme` — define `--font-size-label-sm` through `--font-size-headline-sm` per design.md Decision 3
- [x] 1.3 Rewrite `@layer base` — update `body` background/color to use `surface`/`on-surface`, update `body::before` radial gradients from purple to teal/blue-lavender, update scrollbar thumb color
- [x] 1.4 Rewrite `@layer components` utility classes — update `text-gradient`, `glass`, `border-themed`, `ring-themed`, `shadow-glow`, `btn-primary`, `btn-ghost`, `btn-danger`, `field-input`, `field-textarea`, `tile`, `tab-btn`, `pack-cell`, `wdot`, `rank-badge`, `progress-fill`, `hint-warn`, `hint-soft`, `verify-result` to use new M3 tokens and add state layer styles (hover/focus-visible/active)

## 2. Component Token Migration — Game Views

- [x] 2.1 Update `EmailGate.vue` — replace `text-lilac`, `border-lilac`, `text-muted`, `text-gradient` color references with M3 role equivalents; replace arbitrary text sizes with named scale tokens
- [x] 2.2 Update `TopBar.vue` — replace color token references and arbitrary text sizes with M3 roles and named scale
- [x] 2.3 Update `AppTabs.vue` — replace `text-muted`, `text-neon`, `border-themed`, `bg-app-2` with M3 equivalents; add state layer classes to tab buttons
- [x] 2.4 Update `SetupPanel.vue` — replace color and text size references with M3 tokens
- [x] 2.5 Update `BoardPanel.vue` — replace color references with M3 tokens
- [x] 2.6 Update `BingoGrid.vue` — replace `text-lilac`, `text-text`, `text-muted` with M3 equivalents; replace arbitrary text sizes
- [x] 2.7 Update `HudBar.vue` — replace `text-gradient`, `text-muted` and arbitrary text sizes with M3 tokens
- [x] 2.8 Update `ChallengeBar.vue` — replace color and text size references with M3 tokens
- [x] 2.9 Update `TileModal.vue` — replace `border-lilac-2`, `bg-app-2`, hardcoded `rgba` shadow with M3 tokens
- [x] 2.10 Update `WinModal.vue` — replace hardcoded purple confetti hex array with new teal palette colors; replace `border-neon`, `bg-app-2`, hardcoded `rgba` shadow

## 3. Component Token Migration — Content Views

- [x] 3.1 Update `KeywordsPanel.vue` — replace `bg-[rgba(192,132,252,0.25)]` hardcoded border and color tokens
- [x] 3.2 Update `SubmitPanel.vue` — replace color and text size references with M3 tokens
- [x] 3.3 Update `LeaderboardTable.vue` — replace 4 hardcoded `border-[rgba(192,132,252,0.15)]` occurrences and text size references; add hover state layer to table rows
- [x] 3.4 Update `HelpPanel.vue` — replace color and text size references with M3 tokens
- [x] 3.5 Update `GameFooter.vue` — replace `border-[rgba(192,132,252,0.15)]` with `border-outline-variant`
- [x] 3.6 Update `ToastMessage.vue` — replace color token references with M3 equivalents

## 4. Component Token Migration — Admin Views

- [x] 4.1 Update `AdminLogin.vue` — replace color and text size references with M3 tokens
- [x] 4.2 Update `AdminDashboard.vue` — replace color tokens and hardcoded borders
- [x] 4.3 Update `AdminCampaigns.vue` — replace color tokens and hardcoded borders
- [x] 4.4 Update `AdminOrganizations.vue` — replace color tokens and hardcoded borders
- [x] 4.5 Update `AdminPlayers.vue` — replace 10 hardcoded `border-[rgba(192,132,252,0.15)]` occurrences and color tokens

## 5. Test Updates

- [x] 5.1 Update test files that assert on CSS class names containing old token names (e.g., `text-lilac`, `bg-app`, `border-lilac`) to use new M3 class names
- [x] 5.2 Run full test suite (`npm test` in `frontend/`) and fix any remaining failures

## 6. Visual Verification

- [x] 6.1 Verify all game views render correctly with new palette — EmailGate, SetupPanel, BoardPanel (tiles, HUD, challenge bar), SubmitPanel, KeywordsPanel, HelpPanel, TileModal, WinModal
- [x] 6.2 Verify admin views render correctly — AdminLogin, AdminDashboard, AdminCampaigns, AdminOrganizations, AdminPlayers
- [x] 6.3 Verify WCAG AA contrast ratios pass for primary text on surface, secondary text on surface, and label text on surface-container backgrounds
- [x] 6.4 Grep audit for any remaining hardcoded purple hex values or `rgba(192,132,252` references across all component files
