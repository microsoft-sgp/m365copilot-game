## MODIFIED Requirements

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
