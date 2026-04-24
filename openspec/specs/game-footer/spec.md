# game-footer

## Purpose

Defines the footer component displayed at the bottom of game views for attribution and branding.

## Requirements

### Requirement: Footer displays attribution on all game views
The system SHALL render a footer component at the bottom of every game view (EmailGate, main game tabs) displaying "Designed by Microsoft Student Ambassadors" on the first line and "Powered by Microsoft" on the second line, centered horizontally.

#### Scenario: Footer visible on email gate
- **GIVEN** a user opens the game for the first time
- **WHEN** the EmailGate landing screen renders
- **THEN** the footer MUST be visible below the email form card displaying "Designed by Microsoft Student Ambassadors" and "Powered by Microsoft"

#### Scenario: Footer visible on game tabs
- **GIVEN** a player has entered their email and has an active board
- **WHEN** any tab (Game Board, My Keywords, Submit & Leaderboard, Help) is displayed
- **THEN** the footer MUST appear below the tab content with the attribution text

#### Scenario: Footer hidden on admin views
- **GIVEN** an admin user navigates to the admin login or admin dashboard
- **WHEN** the admin view renders
- **THEN** the footer MUST NOT be displayed

### Requirement: Footer does not interfere with bottom navigation on compact screens
The system SHALL position the footer above the bottom navigation bar on compact screens, ensuring no content overlap.

#### Scenario: Footer renders above bottom nav on compact
- **GIVEN** a player views the game on a compact screen (<640px)
- **WHEN** the bottom navigation bar and footer are both visible
- **THEN** the footer MUST render in the document flow above the bottom-nav safe area padding, without overlapping the fixed navigation bar
