## ADDED Requirements

### Requirement: Admin score surfaces use nickname terminology
The system SHALL present player identity fields as nicknames in admin dashboard tables and exports while preserving backend compatibility with existing `player_name` data.

#### Scenario: Recent sessions table labels player identity as nickname
- **GIVEN** the admin dashboard returns recent session rows containing player identity data
- **WHEN** the Recent Sessions table renders
- **THEN** the player identity column MUST be labeled and understood as nickname rather than name

#### Scenario: Recent score events table labels player identity as nickname
- **GIVEN** the admin dashboard returns recent score event rows containing player identity data
- **WHEN** the Recent Score Events table renders
- **THEN** the player identity column MUST be labeled and understood as nickname rather than name

#### Scenario: CSV export uses nickname header
- **GIVEN** an admin downloads campaign scoring data
- **WHEN** the CSV is generated
- **THEN** the player identity header MUST be `nickname` while values MAY continue to come from the existing `players.player_name` backing column