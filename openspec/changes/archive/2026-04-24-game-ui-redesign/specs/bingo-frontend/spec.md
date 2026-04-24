## MODIFIED Requirements

### Requirement: Tailwind CSS is the primary styling entry
The system SHALL style the migrated frontend through Tailwind CSS, with `tailwind.css` serving as the primary global stylesheet entry for shared theme tokens, reusable visual effects, and responsive presentation. Typography sizes MUST align with Material Design 3 type scale minimums: body text at 14px (0.875rem) minimum, label text at 11px (0.6875rem) minimum, and header letter-spacing at 0.5px maximum for label-style text.

#### Scenario: Tailwind styling is applied to the migrated experience
- **GIVEN** the migrated frontend is loaded in a supported browser
- **WHEN** the interface renders the game shell and its primary interactive views
- **THEN** the experience MUST render with Tailwind-driven styling rather than depending on the legacy inline stylesheet from the single-file implementation

#### Scenario: Responsive layout remains usable on smaller screens
- **GIVEN** a player views the migrated frontend on a narrow viewport (<640px)
- **WHEN** the setup form, board, or modal views are displayed
- **THEN** the layout MUST adapt to the compact screen using Tailwind responsive breakpoints (2-column grid, bottom navigation, full-screen modals, compact TopBar) without horizontal overflow

#### Scenario: Typography meets M3 minimum sizes
- **GIVEN** the game renders on any viewport size
- **WHEN** table body cells, tile descriptions, form labels, or leaderboard entries are displayed
- **THEN** body text MUST be at least 14px, table header letter-spacing MUST NOT exceed 0.5px, and all text MUST meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)

## ADDED Requirements

### Requirement: TopBar displays game title as the hero element
The system SHALL render the game title "⚡ COPILOT BINGO" as the primary visual element of the TopBar, with no corporate branding text. Score indicators SHALL display as compact emoji+number pairs (🔥 tiles, ⭐ lines, 🔑 keys).

#### Scenario: TopBar renders game-focused header
- **GIVEN** a player has entered their email and the game shell is active
- **WHEN** the TopBar renders
- **THEN** the TopBar MUST show the game title prominently, display scores as emoji+number pairs, and MUST NOT contain "Powered by" or brand attribution text

### Requirement: Leaderboard renders above submission form on Submit tab
The system SHALL display the Organization Leaderboard card above the keyword submission form in the SubmitPanel, reversing the current order.

#### Scenario: Leaderboard appears first on Submit tab
- **GIVEN** a player navigates to the Submit & Leaderboard tab
- **WHEN** the SubmitPanel renders
- **THEN** the Organization Leaderboard card MUST appear above the keyword submission form card

#### Scenario: Player's organization is visually highlighted
- **GIVEN** the leaderboard contains multiple organizations and the player's email matches a detected organization
- **WHEN** the leaderboard renders
- **THEN** the player's organization row MUST be visually distinguished from other rows (e.g., highlighted border or background)

### Requirement: Tiles have enhanced game-like visual styling
The system SHALL render bingo tiles with enhanced visual feedback: a scale+glow hover effect on unclaimed tiles and a subtle CSS shimmer animation on unclaimed tiles to draw attention.

#### Scenario: Unclaimed tile shows hover effect
- **GIVEN** a player has an active board with unclaimed tiles
- **WHEN** the player hovers over or touches an unclaimed tile
- **THEN** the tile MUST scale slightly (approximately 1.03×) and show a glow shadow effect

#### Scenario: Unclaimed tiles have subtle shimmer
- **GIVEN** a player has an active board with unclaimed tiles
- **WHEN** the board renders
- **THEN** unclaimed tiles MUST display a subtle CSS shimmer animation (slow, low-opacity) to indicate they are interactive

#### Scenario: Cleared tiles do not shimmer
- **GIVEN** a player has cleared one or more tiles
- **WHEN** the board renders
- **THEN** cleared tiles MUST NOT display the shimmer animation

### Requirement: HudBar displays motivational micro-copy
The system SHALL display a short motivational message in the HudBar that changes based on the player's board progress percentage.

#### Scenario: HudBar shows starter motivation at 0%
- **GIVEN** a player has just started a board with no tiles cleared
- **WHEN** the HudBar renders
- **THEN** the HudBar MUST display a motivational message such as "Let's get started! Pick a tile."

#### Scenario: HudBar shows progress motivation at mid-progress
- **GIVEN** a player has cleared between 1 and 6 tiles
- **WHEN** the HudBar renders
- **THEN** the HudBar MUST display a motivational message reflecting their progress (e.g., "Nice start!", "On fire! 🔥", "Almost there!")

#### Scenario: HudBar shows completion message at 100%
- **GIVEN** a player has cleared all 9 tiles
- **WHEN** the HudBar renders
- **THEN** the HudBar MUST display a completion message such as "Board complete! 🎉"

### Requirement: Help panel shows player-relevant content only
The system SHALL display player-relevant instructions in the HelpPanel and MUST NOT display developer-facing notes such as browser security disclaimers, prototype warnings, or COPILOT_URL configuration details.

#### Scenario: Help panel shows gameplay instructions
- **GIVEN** a player navigates to the Help tab
- **WHEN** the HelpPanel renders
- **THEN** the panel MUST show the numbered how-to-play instructions and a link to open Copilot Chat

#### Scenario: Help panel hides developer notes
- **GIVEN** a player navigates to the Help tab
- **WHEN** the HelpPanel renders
- **THEN** the panel MUST NOT display "Browser Security Note", "Keyword Security Note (Prototype)", or COPILOT_URL configuration text

### Requirement: Leaderboard table has loading and error states
The system SHALL display a loading skeleton while leaderboard data is being fetched and an error message if the API call fails.

#### Scenario: Loading skeleton during fetch
- **GIVEN** the leaderboard is polling for data
- **WHEN** the API request is in-flight
- **THEN** the LeaderboardTable MUST display a placeholder skeleton (animated shimmer rows) instead of the "No submissions yet" message

#### Scenario: Error state on API failure
- **GIVEN** the leaderboard API call fails
- **WHEN** the LeaderboardTable attempts to display data
- **THEN** the component MUST display a brief error message (e.g., "Couldn't load leaderboard. Will retry shortly.") and continue polling
