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

### Requirement: Footer displays service health status label on game views

The system SHALL render a compact health status indicator in the footer on every game-facing view (EmailGate landing and main game tabs), positioned above the existing attribution text. The indicator SHALL consist of a colored status dot and a short status word, with no tooltip or hover-only content. The indicator MUST NOT appear on admin views.

#### Scenario: Initial render before first health probe response

- **GIVEN** a player loads the game and the footer mounts for the first time
- **WHEN** the health probe has not yet returned a response
- **THEN** the footer MUST render the status indicator slot in the document flow with a neutral state ("Checking…") so layout does not reflow when the first response arrives

#### Scenario: API and database both healthy

- **GIVEN** the health endpoint returns `{ status: "healthy", api: "up", database: "up" }`
- **WHEN** the footer receives the probe result
- **THEN** the indicator MUST display a green dot with the word "Online"

#### Scenario: API reachable but database probe failed

- **GIVEN** the health endpoint returns `{ status: "degraded", api: "up", database: "down" }`
- **WHEN** the footer receives the probe result
- **THEN** the indicator MUST display an amber dot with the word "Degraded" and MUST NOT expose database-specific terminology in the visible label

#### Scenario: API unreachable or timed out

- **GIVEN** the health probe fails with a network error or timeout (frontend `status: 0`)
- **WHEN** the footer receives the failure
- **THEN** the indicator MUST display a red dot with the word "Offline"

#### Scenario: Recovery from offline back to healthy

- **GIVEN** the indicator is currently showing "Offline"
- **WHEN** a subsequent probe returns `{ status: "healthy" }`
- **THEN** the indicator MUST update to the green "Online" state within one polling cycle

#### Scenario: Footer health indicator hidden on admin views

- **GIVEN** an admin user navigates to the admin login or admin dashboard
- **WHEN** the admin view renders
- **THEN** the footer MUST NOT be displayed and therefore the health indicator MUST NOT be visible

### Requirement: Health status is polled on a fixed cadence with mount and visibility triggers

The system SHALL probe the backend health endpoint immediately when the footer mounts on a game view, then at a fixed 30-second interval while mounted, and additionally whenever the document transitions from hidden to visible.

#### Scenario: Probe fires on mount

- **GIVEN** a game view is loading
- **WHEN** the footer mounts
- **THEN** a health probe MUST be issued before the first 30-second interval elapses

#### Scenario: Probe fires every 30 seconds

- **GIVEN** the footer has been mounted for at least 30 seconds
- **WHEN** no other trigger has fired
- **THEN** a probe MUST be issued every 30 seconds while the footer remains mounted

#### Scenario: Probe fires on tab visibility regained

- **GIVEN** the browser tab was hidden and the footer remained mounted
- **WHEN** the tab becomes visible again
- **THEN** a probe MUST be issued immediately to refresh potentially stale status

#### Scenario: Polling stops on unmount

- **GIVEN** the footer is unmounted (e.g., navigating into the admin view)
- **WHEN** unmount completes
- **THEN** the polling interval and visibility listener MUST be cleared so no further probes are issued
