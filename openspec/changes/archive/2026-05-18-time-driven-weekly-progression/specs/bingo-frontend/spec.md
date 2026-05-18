## MODIFIED Requirements

### Requirement: Board progression and verification parity

The system SHALL preserve board progression rules, including task prompt display, proof submission, verification feedback, tile clearing, line completion detection, keyword minting, and weekly challenge progression. Weekly challenge availability SHALL be time-driven from the board's `challengeStartAt`: Week 1 is open at board start, Week 2 opens after seven elapsed days, and later weeks open after each additional seven-day interval, capped by the configured total week count. Weekly challenge availability MUST NOT require earlier weekly clears to be completed. For heading-based proof rules, the system SHALL accept required headings when they appear either as Markdown heading lines or as standalone plain section-label lines matching the required heading text.

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

#### Scenario: Week opens from elapsed board time

- **GIVEN** a player started a board at least seven days ago and has not completed Week 1
- **WHEN** the player reloads or resumes the board
- **THEN** the frontend MUST display Week 2 as the current open week while leaving Week 1 incomplete

#### Scenario: Stale restored week catches up before display

- **GIVEN** a saved or server-hydrated challenge profile has `currentWeek` set to 1 and `challengeStartAt` more than seven days in the past
- **WHEN** the frontend restores that board state
- **THEN** the frontend MUST normalize the challenge profile so the current week reflects elapsed time before rendering weekly progress

#### Scenario: Weekly award uses current timed week

- **GIVEN** Week 2 is open based on elapsed board time and Week 1 has not been submitted
- **WHEN** the player completes a qualifying Bingo line for a weekly clear
- **THEN** the system MUST award the Week 2 weekly keyword and MUST NOT backfill or require the Week 1 weekly keyword
