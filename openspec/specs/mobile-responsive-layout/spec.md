# mobile-responsive-layout

## Purpose

Defines responsive layout adaptations for compact (<640px) and expanded (>=640px) screen sizes, ensuring the game is usable on mobile devices without horizontal overflow.

## Requirements

### Requirement: Compact layout adapts to screens under 640px

The system SHALL apply a compact layout on viewports narrower than 640px (Tailwind `sm:` breakpoint), adjusting component sizing, spacing, and visibility to remain usable without horizontal overflow. All text on compact screens SHALL use the named M3 typography scale with a minimum of 11px (`text-label-sm`).

#### Scenario: No horizontal overflow on 375px viewport

- **GIVEN** a player opens the game on a 375px-wide device
- **WHEN** any game view renders (EmailGate, SetupPanel, BoardPanel, SubmitPanel, KeywordsPanel, HelpPanel)
- **THEN** the view MUST NOT produce horizontal scrollbars or overflow beyond the viewport width

#### Scenario: Content remains readable on compact screens

- **GIVEN** a player views the game on a compact screen
- **WHEN** any text content renders
- **THEN** all body text MUST be at least 14px (`text-body-md`) and all label text MUST be at least 11px (`text-label-sm`), using named typography scale tokens instead of arbitrary pixel values

### Requirement: TopBar hides non-essential content on compact screens

The system SHALL hide the branding text on compact screens, showing only the game title and compact score indicators.

#### Scenario: TopBar on compact shows title and scores only

- **GIVEN** a player views the game on a compact screen (<640px)
- **WHEN** the TopBar renders
- **THEN** the branding text MUST be hidden, the game title MUST be visible, and score indicators MUST display as compact emoji+number pairs

#### Scenario: TopBar on expanded shows full layout

- **GIVEN** a player views the game on an expanded screen (>=640px)
- **WHEN** the TopBar renders
- **THEN** the game title MUST be centered and the score indicators MUST display with full labels

### Requirement: Tab navigation repositions to bottom on compact screens

The system SHALL render the tab navigation as a fixed bottom bar on compact screens (<640px) and as a top horizontal bar on expanded screens.

#### Scenario: Tabs render at bottom on compact

- **GIVEN** a player views the game on a compact screen
- **WHEN** the AppTabs component renders
- **THEN** the tabs MUST be fixed to the bottom of the viewport with icon and short-label layout, spanning the full width

#### Scenario: Tabs render at top on expanded

- **GIVEN** a player views the game on an expanded screen (>=640px)
- **WHEN** the AppTabs component renders
- **THEN** the tabs MUST render below the TopBar in a horizontal row as the current pill-style buttons

#### Scenario: Bottom nav does not overlap content

- **GIVEN** the tabs are rendered as bottom navigation on compact
- **WHEN** the player scrolls to the bottom of any tab's content
- **THEN** the content MUST have sufficient bottom padding to prevent the last content items from being hidden behind the fixed bottom bar

### Requirement: Bingo grid adapts columns to screen width

The system SHALL render the bingo grid in 2 columns on compact screens and 3 columns on expanded screens.

#### Scenario: Grid renders 2 columns on compact

- **GIVEN** a player has an active board and views the game on a compact screen
- **WHEN** the BingoGrid component renders
- **THEN** the tiles MUST render in a 2-column layout with the 9th tile centered in the last row

#### Scenario: Grid renders 3 columns on expanded

- **GIVEN** a player has an active board and views the game on an expanded screen (>=640px)
- **WHEN** the BingoGrid component renders
- **THEN** the tiles MUST render in the standard 3×3 grid layout

### Requirement: Tile modal fills viewport on compact screens

The system SHALL render the TileModal as a full-screen dialog on compact screens and as a centered floating card on expanded screens.

#### Scenario: Modal is full-screen on compact

- **GIVEN** a player opens a tile on a compact screen
- **WHEN** the TileModal renders
- **THEN** the modal MUST fill the entire viewport with no border-radius and reduced padding (16px) to maximise content space

#### Scenario: Modal is centered card on expanded

- **GIVEN** a player opens a tile on an expanded screen (>=640px)
- **WHEN** the TileModal renders
- **THEN** the modal MUST render as a centered card with max-width 600px, border-radius 20px, and 28px padding

### Requirement: Interactive elements meet minimum touch target size

The system SHALL ensure all interactive elements (buttons, tab buttons, tile cards, links) have a minimum touch target of 48×48 CSS pixels on compact screens.

#### Scenario: Tab buttons meet touch target minimum

- **GIVEN** the bottom navigation is visible on a compact screen
- **WHEN** the tab buttons render
- **THEN** each tab button MUST have a minimum tappable area of 48×48px

#### Scenario: Bingo tiles meet touch target minimum

- **GIVEN** the bingo grid is visible on any screen size
- **WHEN** the tile cards render
- **THEN** each tile MUST have a minimum height of 48px (current min-height of 120px already exceeds this)
