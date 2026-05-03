# pack-assignment-lifecycle

## Purpose

Defines server-authoritative pack assignment lifecycle behavior across player-campaign cycles, including assignment creation, completion-based rotation, and concurrency invariants.

## Requirements

### Requirement: Server-authoritative pack assignment lifecycle

The system SHALL assign one active pack per player per campaign, persist that assignment server-side, and treat it as the authoritative source for board startup across devices. When creating a new active assignment, the system SHALL avoid duplicate active pack ids within the same campaign while campaign pack capacity remains available, and SHALL allow duplicate active pack ids only after every campaign-supported pack id already has at least one active assignment. The system SHALL reuse incomplete active assignments during normal login or board startup unless the player explicitly requests a New Board reroll.

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

#### Scenario: Active assignment is reused while incomplete unless reroll is requested

- **GIVEN** a player has an active assignment and the cycle is incomplete
- **WHEN** the player logs in or starts a board from any device without requesting a New Board reroll
- **THEN** the system MUST return the same assigned pack id and MUST NOT create a different active assignment

### Requirement: User-initiated pack reroll

The system SHALL allow a player to request a New Board reroll that abandons the current active assignment and creates exactly one replacement active assignment for the same player and campaign. Abandoned assignments SHALL remain historical records, SHALL NOT be treated as completed assignments, and SHALL NOT blacklist their pack ids for that player.

#### Scenario: Reroll abandons current assignment and creates replacement

- **GIVEN** a player has an active assignment for the active campaign
- **WHEN** the player requests a New Board reroll
- **THEN** the system MUST mark the current assignment as abandoned and create exactly one new active assignment for that player and campaign

#### Scenario: Abandoned pack remains eligible for future assignments

- **GIVEN** a player previously abandoned pack 42
- **WHEN** a later assignment is created for the same player after another assignment cycle or reroll
- **THEN** the system MUST NOT exclude pack 42 solely because the player abandoned it previously

#### Scenario: Immediate reroll prefers a different pack

- **GIVEN** a player is abandoning pack 42
- **AND** at least one campaign-supported pack other than 42 can be selected under the assignment distribution rules
- **WHEN** the replacement assignment is created
- **THEN** the system MUST choose a pack other than 42

#### Scenario: Immediate reroll can reuse pack when no alternative exists

- **GIVEN** a player is abandoning pack 42
- **AND** no campaign-supported pack other than 42 can be selected
- **WHEN** the replacement assignment is created
- **THEN** the system MUST create a valid active assignment even if the pack id is 42

#### Scenario: Reroll without active assignment creates assignment

- **GIVEN** a player has no active assignment for the active campaign
- **WHEN** the player requests a New Board reroll
- **THEN** the system MUST create one active assignment using the normal campaign assignment distribution rules

### Requirement: Reroll concurrency preserves active assignment invariants

The system SHALL preserve the one-active-assignment-per-player-campaign invariant when New Board reroll requests occur concurrently with login, state bootstrap, session creation, or other reroll requests.

#### Scenario: Concurrent rerolls converge on one replacement assignment

- **GIVEN** two or more New Board reroll requests are processed concurrently for the same player and campaign
- **WHEN** assignment lifecycle resolution completes
- **THEN** the system MUST leave exactly one active assignment for that player and campaign

#### Scenario: Reroll and login do not resurrect abandoned assignment

- **GIVEN** a New Board reroll request is abandoning a player's active assignment
- **WHEN** a concurrent login or session bootstrap request resolves player state
- **THEN** the system MUST NOT return the abandoned assignment as the player's active assignment after the reroll commits

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
