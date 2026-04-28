## MODIFIED Requirements

### Requirement: Bingo grid renders as a 3×3 layout on all screen sizes

The system SHALL render the bingo grid as a fixed 3-column layout on every supported viewport, producing a 3×3 arrangement of the 9 tiles. On compact screens (<640px), the system SHALL apply tightened tile padding and grid gap so the grid fits a 375px viewport without horizontal overflow, and SHALL apply `overflow-wrap: anywhere` to tile content so long single words cannot force horizontal overflow.

#### Scenario: Grid renders 3 columns on compact

- **GIVEN** a player has an active board and views the game on a compact screen (<640px)
- **WHEN** the BingoGrid component renders
- **THEN** the tiles MUST render in a 3-column layout with no special-case orphan tile handling

#### Scenario: Grid renders 3 columns on expanded

- **GIVEN** a player has an active board and views the game on an expanded screen (>=640px)
- **WHEN** the BingoGrid component renders
- **THEN** the tiles MUST render in the standard 3×3 grid layout

#### Scenario: No horizontal overflow with longest task bank content on 375px

- **GIVEN** a player views the game on a 375px-wide device with any tile in the task bank
- **WHEN** the BingoGrid renders the 3-column layout
- **THEN** the grid MUST NOT produce horizontal scrollbars or overflow beyond the viewport width, even for the longest titles ("Stakeholder Email", "Competitive Analysis") and tags ("Decision Making")

## REMOVED Requirements

### Requirement: Bingo grid adapts columns to screen width

**Reason**: The 2-column compact layout breaks the iconic 3×3 bingo geometry and required an orphan-centering special case for the 9th tile. The replacement requirement above mandates 3 columns at all sizes.

**Migration**: All callers continue to use `BingoGrid.vue` with no API change. The visual layout on viewports <640px changes from 2 columns × 5 rows (with the 9th tile centered) to 3 columns × 3 rows. No data migration required.
