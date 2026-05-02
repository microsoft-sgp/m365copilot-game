## MODIFIED Requirements

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