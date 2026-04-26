## MODIFIED Requirements

### Requirement: Tailwind CSS is the primary styling entry
The system SHALL style the frontend through Tailwind CSS, with `tailwind.css` serving as the primary global stylesheet entry. The `@theme` block SHALL define color tokens using Material Design 3 dark scheme role names derived from a teal seed color (`#00BCD4`). Typography sizes SHALL be defined as named `@theme` font-size tokens mapped to the M3 type scale. Body text SHALL be at minimum 14px (0.875rem), label text at minimum 11px (0.6875rem), and header letter-spacing at 0.5px maximum for label-style text. All interactive elements SHALL implement M3 state layers: hover (8% primary overlay), focus-visible (outline ring), pressed (10% primary overlay), and disabled (38% foreground opacity with 12% surface overlay).

#### Scenario: Tailwind styling is applied to the migrated experience
- **GIVEN** the migrated frontend is loaded in a supported browser
- **WHEN** the interface renders the game shell and its primary interactive views
- **THEN** the experience MUST render with Tailwind-driven styling using M3 dark scheme teal-family colors rather than the legacy purple/neon palette

#### Scenario: Responsive layout remains usable on smaller screens
- **GIVEN** a player views the migrated frontend on a narrow viewport (<640px)
- **WHEN** the setup form, board, or modal views are displayed
- **THEN** the layout MUST adapt to the compact screen using Tailwind responsive breakpoints (2-column grid, bottom navigation, full-screen modals, compact TopBar) without horizontal overflow

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
