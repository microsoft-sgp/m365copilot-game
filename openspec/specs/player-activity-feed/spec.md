# player-activity-feed

## Purpose

Defines the read-only My Activity player experience backed by verified progression-scoring records.

## Requirements

### Requirement: Read-only player activity timeline

The system SHALL provide a My Activity view that displays a read-only timeline of a player's verified progression events and awarded score-bearing records.

#### Scenario: Player opens My Activity

- **GIVEN** a player is authenticated by email identity in the game client
- **WHEN** the player navigates to the My Activity tab
- **THEN** the system MUST display activity entries with event type, campaign context, and timestamp in descending time order

### Requirement: Activity entries are non-editable and non-submittable

The system SHALL prevent players from creating, editing, or manually submitting score records from the My Activity view.

#### Scenario: Player attempts to find submission controls

- **GIVEN** a player is on the My Activity tab
- **WHEN** the activity view renders
- **THEN** the system MUST NOT display manual keyword input controls or score submission actions

### Requirement: Activity feed aligns with leaderboard scoring source

The system SHALL source activity score-bearing entries from the same progression-scoring records used by leaderboard aggregation.

#### Scenario: New score event appears in activity and leaderboard

- **GIVEN** a player earns a score-bearing progression event
- **WHEN** the backend persists the event
- **THEN** the event MUST be visible in My Activity and reflected in leaderboard aggregates without requiring manual submission
