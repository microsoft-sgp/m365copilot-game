## MODIFIED Requirements

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