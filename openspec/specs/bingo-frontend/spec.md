# bingo-frontend

## Purpose

Defines the user-facing Bingo game frontend: how the application is structured, how boards are generated and progressed, how state and submissions persist in the browser, and how the experience is styled.

## Requirements

### Requirement: Dedicated Vue frontend application

The system SHALL provide the Bingo game through a dedicated frontend application located in `frontend/`, with the game experience rendered by Vue components instead of a single static HTML file with imperative DOM updates.

#### Scenario: Frontend application loads the game shell

- **GIVEN** a user opens the migrated frontend entry point
- **WHEN** the application initializes successfully
- **THEN** the user MUST see the game shell with Game, Keys, My Activity, and Help sections available from the interface

### Requirement: Deterministic board setup and generation

The system SHALL allow a player to start a board using a server-assigned pack number from 1 through 999, and the same pack number MUST generate the same task set and order as the current implementation. Player display name SHALL be collected during onboarding identity and MUST NOT be re-requested in board setup.

#### Scenario: Player starts a board with assigned pack number

- **GIVEN** the player has completed onboarding identity and a valid assigned pack number exists
- **WHEN** the player starts the board
- **THEN** the system MUST create a 3x3 board with nine tasks derived deterministically from that pack number

#### Scenario: Setup does not expose manual pack choice

- **GIVEN** the player is on the setup view without an active board
- **WHEN** the setup view renders
- **THEN** the system MUST display the assigned pack and MUST NOT allow manual pack entry or quick-pick selection

### Requirement: New Board rerolls assigned pack

The frontend SHALL treat New Board as a server-authoritative pack reroll. When the player confirms New Board from an active board, the frontend SHALL request an assignment reroll, replace local board state only after the server returns the new assignment, and start a fresh board for the returned pack and game session.

#### Scenario: Player confirms New Board reroll

- **GIVEN** a player has an active board with a gameSessionId and assigned pack
- **WHEN** the player clicks New Board and confirms the action
- **THEN** the frontend MUST call the assignment reroll API before clearing local board state
- **AND** the frontend MUST initialize a fresh 3x3 board using the returned packId and gameSessionId

#### Scenario: Player declines New Board confirmation

- **GIVEN** a player has an active board
- **WHEN** the player clicks New Board and declines the confirmation
- **THEN** the frontend MUST leave the current board, progress, assigned pack, and gameSessionId unchanged

#### Scenario: Reroll failure preserves current board

- **GIVEN** a player has an active board
- **WHEN** the player confirms New Board and the reroll API fails or returns an error
- **THEN** the frontend MUST keep the current board active and MUST NOT clear local progress

#### Scenario: Reroll success clears old progress locally

- **GIVEN** a player has cleared tiles, won lines, or earned keywords on the current board
- **WHEN** the New Board reroll succeeds
- **THEN** the frontend MUST clear local tile progress, won lines, and board keywords for the new board while preserving player identity

#### Scenario: New Board copy explains pack replacement

- **GIVEN** a player clicks New Board
- **WHEN** the confirmation is shown
- **THEN** the copy MUST explain that current board progress will be cleared and a new pack will be assigned

#### Scenario: Setup copy does not describe rerolled pack as locked

- **GIVEN** the player is on the setup view after assignment hydration or reroll
- **WHEN** the assigned-pack status text is rendered
- **THEN** the frontend MUST NOT tell the player the pack is locked for the challenge cycle

### Requirement: Board progression and verification parity

The system SHALL preserve the current board progression rules, including task prompt display, proof submission, verification feedback, tile clearing, line completion detection, keyword minting, and weekly challenge progression. For heading-based proof rules, the system SHALL accept required headings when they appear either as Markdown heading lines or as standalone plain section-label lines matching the required heading text.

#### Scenario: Proof passes verification for a tile

- **GIVEN** a player has opened a tile and submitted proof that satisfies that tile's verification rules
- **WHEN** the player confirms verification
- **THEN** the system MUST mark the tile as cleared, persist the updated board state, and update progress indicators in the interface

#### Scenario: Heading proof uses plain section labels

- **GIVEN** a player has opened a tile whose proof rules require headings
- **WHEN** the player submits proof containing each required heading as a standalone plain section-label line without Markdown hash prefixes
- **THEN** the system MUST accept those headings as satisfying the heading proof rule

#### Scenario: Heading proof uses Markdown headings

- **GIVEN** a player has opened a tile whose proof rules require headings
- **WHEN** the player submits proof containing each required heading as a Markdown heading line
- **THEN** the system MUST accept those headings as satisfying the heading proof rule

#### Scenario: Heading text appears only inside prose

- **GIVEN** a player has opened a tile whose proof rules require headings
- **WHEN** the player submits proof where required heading text appears only inside ordinary prose and not as a standalone heading or section-label line
- **THEN** the system MUST reject the proof with missing-heading validation feedback

#### Scenario: Player completes a Bingo line

- **GIVEN** a player clears the last remaining tile for a row, column, or diagonal that has not yet been awarded
- **WHEN** the board state is re-evaluated
- **THEN** the system MUST award the corresponding keyword once, record the completed line, and present the win feedback to the player

### Requirement: Browser persistence and session continuity

The system SHALL persist game state in browser storage for offline resilience, additionally report game session starts and tile events to the server, and sync full board state to the server for cross-device recovery.

#### Scenario: Player starts a board and session is reported

- **GIVEN** a player has completed onboarding identity and receives a server-assigned pack during startup
- **WHEN** the board is created
- **THEN** the system MUST persist state to localStorage AND send `POST /api/sessions` with sessionId, playerName, assigned packId, and email to register the session server-side

#### Scenario: Player clears a tile and event is reported

- **GIVEN** a player has an active board with a known gameSessionId
- **WHEN** a tile is verified and cleared
- **THEN** the system MUST update localStorage, send `POST /api/events` to record the tile event, AND send `PATCH /api/sessions/:id` with the full board state for cross-device sync

#### Scenario: API failure does not block gameplay

- **GIVEN** the backend API is temporarily unavailable
- **WHEN** a session creation or event recording call fails
- **THEN** the game MUST continue normally using localStorage state without displaying errors to the player

#### Scenario: Player reloads with an active board

- **GIVEN** a player has an active board and saved local data in the browser
- **WHEN** the player reloads the page
- **THEN** the system MUST restore the active board, cleared tiles, earned keywords, and related progress from browser storage

### Requirement: Tailwind CSS is the primary styling entry

The system SHALL style the frontend through Tailwind CSS, with `tailwind.css` serving as the primary global stylesheet entry. The `@theme` block SHALL define color tokens using Material Design 3 dark scheme role names derived from a teal seed color (`#00BCD4`). Typography sizes SHALL be defined as named `@theme` font-size tokens mapped to the M3 type scale. Body text SHALL be at minimum 14px (0.875rem), label text at minimum 11px (0.6875rem), and header letter-spacing at 0.5px maximum for label-style text. All interactive elements SHALL implement M3 state layers: hover (8% primary overlay), focus-visible (outline ring), pressed (10% primary overlay), and disabled (38% foreground opacity with 12% surface overlay).

#### Scenario: Tailwind styling is applied to the migrated experience

- **GIVEN** the migrated frontend is loaded in a supported browser
- **WHEN** the interface renders the game shell and its primary interactive views
- **THEN** the experience MUST render with Tailwind-driven styling using M3 dark scheme teal-family colors rather than the legacy purple/neon palette

#### Scenario: Responsive layout remains usable on smaller screens

- **GIVEN** a player views the migrated frontend on a narrow viewport (<640px)
- **WHEN** the setup form, board, or modal views are displayed
- **THEN** the layout MUST adapt to the compact screen using Tailwind responsive breakpoints (3-column bingo grid, bottom navigation, full-screen modals, compact TopBar) without horizontal overflow

#### Scenario: Typography meets M3 minimum sizes

- **GIVEN** the game renders on any viewport size
- **WHEN** table body cells, tile descriptions, form labels, or leaderboard entries are displayed
- **THEN** body text MUST be at least 14px, label text MUST be at least 11px, table header letter-spacing MUST NOT exceed 0.5px, and all text MUST meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)

#### Scenario: Color tokens follow M3 role naming

- **GIVEN** the `@theme` block in `tailwind.css` is inspected
- **WHEN** color tokens are reviewed
- **THEN** tokens MUST use M3 role names (`primary`, `on-primary`, `surface`, `on-surface`, `outline-variant`, etc.) instead of ad-hoc names (`lilac`, `neon`, `app`, `card`)

#### Scenario: Typography uses named scale tokens

- **GIVEN** any Vue component template is inspected
- **WHEN** text size classes are reviewed
- **THEN** text sizes MUST use named Tailwind utilities (`text-label-sm`, `text-label-md`, `text-body-md`, `text-title-lg`, etc.) instead of arbitrary values (`text-[10px]`, `text-[14px]`)

#### Scenario: Interactive elements have consistent state feedback

- **GIVEN** any interactive element (button, tab, tile, link, table row) is rendered
- **WHEN** the user hovers, focuses via keyboard, or presses the element
- **THEN** the element MUST display the appropriate M3 state layer (hover: 8% primary overlay, focus: outline ring, pressed: 10% overlay)

#### Scenario: No hardcoded color values in component templates

- **GIVEN** any Vue component template is inspected
- **WHEN** CSS classes and inline styles are reviewed
- **THEN** there MUST be no hardcoded `rgba(192,132,252,...)` values or purple hex codes; all colors MUST reference design tokens

### Requirement: Leaderboard polls server at regular intervals

The system SHALL poll `GET /api/leaderboard` every 30 seconds to display a shared, up-to-date leaderboard reflecting all participants' submissions.

#### Scenario: Leaderboard refreshes automatically

- **GIVEN** the leaderboard view is visible
- **WHEN** 30 seconds elapse since the last fetch
- **THEN** the system MUST fetch fresh leaderboard data from `GET /api/leaderboard` and update the displayed rankings

#### Scenario: Leaderboard refreshes after submission

- **GIVEN** a player has just submitted a keyword successfully
- **WHEN** the submission API returns success
- **THEN** the system MUST immediately fetch updated leaderboard data rather than waiting for the next polling interval

#### Scenario: Polling stops when leaderboard is not visible

- **GIVEN** the player has navigated away from the leaderboard tab
- **WHEN** the leaderboard component is unmounted or hidden
- **THEN** the system MUST stop polling to avoid unnecessary network requests

### Requirement: Organization leaderboard displays score and contributors clearly

The system SHALL display organization leaderboard rows with distinct visible metrics for rank, score, and contributor count. The score metric SHALL be the visible numeric metric associated with leaderboard rank order, and contributor count MUST be labeled explicitly rather than shown as an ambiguous `#` column.

#### Scenario: Leaderboard renders score and contributor metrics

- **GIVEN** the frontend receives leaderboard rows containing `score`, `contributors`, and `lastSubmission`
- **WHEN** the organization leaderboard renders on the Activity or submission leaderboard view
- **THEN** each row MUST display rank, organization, score, contributor count, and last submission where the viewport supports the timestamp column

#### Scenario: Score explains rank when contributor count differs

- **GIVEN** one organization has a higher score but fewer contributors than another organization
- **WHEN** the organization leaderboard renders the server-provided ranking
- **THEN** the higher-score organization MUST appear above the lower-score organization and the visible score values MUST make the ordering understandable

#### Scenario: Contributor column is explicitly labeled

- **GIVEN** the organization leaderboard has at least one row
- **WHEN** the table headers render
- **THEN** the contributor metric MUST be labeled as contributors or an unambiguous abbreviation, and MUST NOT be labeled only as `#`

### Requirement: API client utility module

The system SHALL provide a thin fetch wrapper at `frontend/src/lib/api.js` for all backend communication, encapsulating the base URL, error handling, and JSON parsing.

#### Scenario: API call succeeds

- **GIVEN** the backend is reachable
- **WHEN** an API function is called
- **THEN** the wrapper MUST return the parsed JSON response body

#### Scenario: API call fails with network error

- **GIVEN** the backend is unreachable
- **WHEN** an API function is called
- **THEN** the wrapper MUST return a failure result without throwing an unhandled exception, allowing callers to fall back to localStorage

### Requirement: TopBar displays game title as the hero element

The system SHALL render the game title "⚡ COPILOT BINGO" as the primary visual element of the TopBar, with no corporate branding text. Score indicators SHALL display as compact emoji+number pairs (🔥 tiles, ⭐ lines, 🔑 keys).

#### Scenario: TopBar renders game-focused header

- **GIVEN** a player has entered their email and the game shell is active
- **WHEN** the TopBar renders
- **THEN** the TopBar MUST show the game title prominently, display scores as emoji+number pairs, and MUST NOT contain "Powered by" or brand attribution text

### Requirement: Tiles have enhanced game-like visual styling

The system SHALL render bingo tiles with enhanced visual feedback: a scale+glow hover effect using teal-family primary color on unclaimed tiles and a subtle CSS shimmer animation using primary color tones on unclaimed tiles to draw attention.

#### Scenario: Unclaimed tile hover effect

- **GIVEN** a player hovers over an unclaimed tile
- **WHEN** the cursor enters the tile
- **THEN** the tile MUST scale to 1.03× and display a teal-toned glow shadow using the primary color

#### Scenario: Unclaimed tile shimmer animation

- **GIVEN** an unclaimed tile is visible on the board
- **WHEN** the tile renders
- **THEN** the tile MUST display a subtle CSS shimmer animation using primary color at low opacity (4%)

#### Scenario: Cleared tile styling

- **GIVEN** a tile has been cleared by the player
- **WHEN** the tile renders
- **THEN** the tile MUST display a teal-toned gradient background using primary-container and primary colors, with a checkmark indicator and glow border

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

The system SHALL display a player-relevant HelpPanel that explains the game as a scannable play-loop guide and MUST NOT display developer-facing notes such as browser security disclaimers, prototype warnings, or COPILOT_URL configuration details.

#### Scenario: Help panel shows play-loop guide

- **GIVEN** a player navigates to the Help tab
- **WHEN** the HelpPanel renders
- **THEN** the panel MUST show the How to Play heading and organize gameplay guidance into Start, Play, Claim, and Track progress sections

#### Scenario: Help panel preserves gameplay instructions

- **GIVEN** a player navigates to the Help tab
- **WHEN** the HelpPanel renders
- **THEN** the panel MUST explain onboarding, assigned pack launch, tile prompt use, Copilot Chat usage, proof verification, Bingo line keyword earning, and activity tracking

#### Scenario: Help panel provides player actions

- **GIVEN** a player navigates to the Help tab
- **WHEN** the HelpPanel renders
- **THEN** the panel MUST provide a link to open Copilot Chat and a control that emits the existing admin navigation action

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

### Requirement: Email gate before board setup

The system SHALL display an email input screen before the setup panel when no player email is stored, and an admin login button SHALL be visible on this screen.

#### Scenario: Email gate displayed on fresh load

- **GIVEN** no player email exists in localStorage
- **WHEN** the application loads
- **THEN** the system MUST show the email gate component instead of the setup panel or game board

#### Scenario: Admin login button visible on email gate

- **GIVEN** the email gate is displayed
- **WHEN** the screen renders
- **THEN** a clearly visible "Admin Login" button MUST be present that navigates to `#/admin/login`

### Requirement: Verify button debounce

The system SHALL disable the verify button in the tile modal during verification to prevent double-click submission.

#### Scenario: Button disabled during verification

- **GIVEN** the player is viewing a tile modal with proof entered
- **WHEN** the player clicks the "Verify & Claim" button
- **THEN** the button MUST be immediately disabled and show a loading state until verification completes

#### Scenario: Button re-enabled after verification

- **GIVEN** the verification process has completed (success or failure)
- **WHEN** the result is displayed
- **THEN** the button MUST be re-enabled (or the modal closes on success)

### Requirement: Consolidated multi-line win feedback

The system SHALL display a single consolidated notification when a tile completion results in multiple line wins, instead of separate notifications per line.

#### Scenario: Single tile completes multiple lines

- **GIVEN** clearing a tile completes two or more bingo lines simultaneously
- **WHEN** the verification succeeds
- **THEN** the system MUST display a single win modal or toast summarizing all lines won and all keywords earned (e.g., "2 lines completed! 2 keywords earned")

### Requirement: Leaderboard table mobile responsiveness

The system SHALL ensure the leaderboard table is usable on mobile viewports without horizontal clipping.

#### Scenario: Table scrolls horizontally on narrow viewport

- **GIVEN** the viewport width is less than the table's natural width
- **WHEN** the leaderboard table renders
- **THEN** the table container MUST have `overflow-x: auto` allowing horizontal scroll

#### Scenario: Timestamp column uses short format on mobile

- **GIVEN** the viewport width is less than 640px
- **WHEN** the "Last Submission" column renders
- **THEN** the timestamp MUST use a short date format (e.g., "23/04") instead of the full datetime string

### Requirement: Leaderboard table contrast improvement

The system SHALL use higher-contrast colors for leaderboard table text and borders on dark backgrounds.

#### Scenario: Table header text is legible

- **GIVEN** the leaderboard table renders on a glass-background card
- **WHEN** the header row is displayed
- **THEN** the header text MUST use `text-lilac` color (#c084fc) instead of `text-muted` (#c4b5fd) for improved contrast

#### Scenario: Row borders are visible

- **GIVEN** the leaderboard table renders
- **WHEN** table rows are displayed
- **THEN** row borders MUST use a border opacity of at least 0.15 instead of the current 0.08
