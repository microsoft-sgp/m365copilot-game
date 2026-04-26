# pack-assignment-lifecycle

## Purpose

Defines server-authoritative pack assignment lifecycle behavior across player-campaign cycles, including assignment creation, completion-based rotation, and concurrency invariants.

## Requirements

### Requirement: Server-authoritative pack assignment lifecycle
The system SHALL assign one active pack per player per campaign, persist that assignment server-side, and treat it as the authoritative source for board startup across devices.

#### Scenario: First assignment for a player campaign
- **GIVEN** a player has no assignment for the active campaign
- **WHEN** the player logs in or starts a board
- **THEN** the system MUST create and persist an active assignment with a pack id in the campaign-supported range

#### Scenario: Active assignment is reused while incomplete
- **GIVEN** a player has an active assignment and the cycle is incomplete
- **WHEN** the player logs in or starts a board from any device
- **THEN** the system MUST return the same assigned pack id and MUST NOT create a different active assignment

### Requirement: Completion-based rotation on next login
The system SHALL rotate a player to a new active pack assignment only after the current cycle is completed, where completion is defined as `weeksCompleted >= totalWeeks` for the active campaign.

#### Scenario: Completed cycle rotates on next bootstrap
- **GIVEN** a player's current assignment is complete at 7 of 7 weeks
- **WHEN** the player next logs in or initializes session bootstrap
- **THEN** the system MUST mark the previous assignment completed and create or select exactly one new active assignment

#### Scenario: Incomplete cycle does not rotate
- **GIVEN** a player's current assignment has fewer than totalWeeks completed
- **WHEN** the player logs in repeatedly
- **THEN** the system MUST keep the same active assignment without rotation

### Requirement: Concurrency-safe active assignment invariants
The system SHALL enforce that at most one active assignment exists per player and campaign, including concurrent login or session requests.

#### Scenario: Concurrent logins converge on one active assignment
- **GIVEN** two or more bootstrap requests are processed concurrently for the same player and campaign
- **WHEN** assignment resolution executes
- **THEN** the system MUST resolve to a single active assignment and return the same assigned pack id to all successful requests