# pack-assignment-lifecycle

## Purpose

Defines server-authoritative pack assignment lifecycle behavior across player-campaign cycles, including assignment creation, completion-based rotation, and concurrency invariants.

## Requirements

### Requirement: Server-authoritative pack assignment lifecycle

The system SHALL assign one active pack per player per campaign, persist that assignment server-side, and treat it as the authoritative source for board startup across devices. When creating a new active assignment, the system SHALL avoid duplicate active pack ids within the same campaign while campaign pack capacity remains available, and SHALL allow duplicate active pack ids only after every campaign-supported pack id already has at least one active assignment.

#### Scenario: First assignment for a player campaign

- **GIVEN** a player has no assignment for the active campaign
- **WHEN** the player logs in or starts a board
- **THEN** the system MUST create and persist an active assignment with a pack id selected by the campaign active-pack distribution rules

#### Scenario: First assignments avoid active duplicates while capacity remains

- **GIVEN** the active campaign supports 999 packs
- **AND** at least one campaign-supported pack id has no active assignment
- **WHEN** a player with no active assignment logs in or starts a board
- **THEN** the system MUST assign a pack id that currently has no active assignment in that campaign

#### Scenario: Duplicate assignments allowed after active pack capacity is exhausted

- **GIVEN** the active campaign supports 999 packs
- **AND** every campaign-supported pack id has at least one active assignment
- **WHEN** a player with no active assignment logs in or starts a board
- **THEN** the system MUST create and persist an active assignment using a campaign-supported pack id even if that pack id is already active for another player

#### Scenario: Overflow assignments prefer least-used active packs

- **GIVEN** every campaign-supported pack id has at least one active assignment
- **AND** active assignment counts are not equal across campaign-supported pack ids
- **WHEN** a player with no active assignment logs in or starts a board
- **THEN** the system MUST choose from pack ids whose active assignment count is the lowest among campaign-supported pack ids

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

The system SHALL enforce that at most one active assignment exists per player and campaign, including concurrent login or session requests, and SHALL make new pack selection atomic so concurrent first-time assignments do not create avoidable duplicate active pack ids while unused campaign pack ids remain.

#### Scenario: Concurrent logins converge on one active assignment

- **GIVEN** two or more bootstrap requests are processed concurrently for the same player and campaign
- **WHEN** assignment resolution executes
- **THEN** the system MUST resolve to a single active assignment and return the same assigned pack id to all successful requests

#### Scenario: Concurrent first assignments avoid duplicate packs while capacity remains

- **GIVEN** two or more bootstrap requests are processed concurrently for different players in the same campaign
- **AND** enough campaign-supported pack ids have no active assignment for each request to receive a distinct pack id
- **WHEN** assignment resolution executes for those players
- **THEN** the system MUST create active assignments with distinct pack ids for those players

#### Scenario: Concurrent overflow assignments remain valid after capacity exhaustion

- **GIVEN** every campaign-supported pack id already has at least one active assignment
- **WHEN** two or more bootstrap requests are processed concurrently for different players in the same campaign
- **THEN** the system MUST create one active assignment per player using campaign-supported pack ids
