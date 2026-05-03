## MODIFIED Requirements

### Requirement: Pack assignment lifecycle persistence

The system SHALL persist pack assignment lifecycle records that identify each player-campaign cycle as active, completed, or abandoned and support completion-based rotation plus user-initiated rerolls. Abandoned assignments SHALL be retained as history, SHALL include an abandonment timestamp, and SHALL NOT create a permanent per-user pack exclusion.

#### Scenario: One active assignment per player campaign

- **GIVEN** assignment lifecycle records exist for a player and campaign
- **WHEN** active records are evaluated
- **THEN** the system MUST enforce at most one active assignment for that player and campaign

#### Scenario: Completed assignment retained as history

- **GIVEN** an active assignment reaches completion
- **WHEN** the next cycle assignment is created
- **THEN** the system MUST preserve the completed assignment record for historical analysis and auditability

#### Scenario: Abandoned assignment retained as history

- **GIVEN** a player requests a New Board reroll
- **WHEN** the current active assignment is replaced
- **THEN** the system MUST preserve the previous assignment with status `abandoned` and a non-null abandonment timestamp

#### Scenario: Abandoned pack does not create blacklist row

- **GIVEN** a player abandons pack 42
- **WHEN** the database records the abandoned assignment
- **THEN** the system MUST NOT create or require a per-player blacklist record that prevents pack 42 from being assigned to that player in the future

#### Scenario: Migration backfills active assignments

- **GIVEN** legacy databases contain players and sessions without lifecycle records
- **WHEN** the migration is applied
- **THEN** the system MUST backfill one active assignment per player-campaign from existing latest session data without losing historical sessions

#### Scenario: Migration allows abandoned status without corrupting existing records

- **GIVEN** existing assignment rows have status `active` or `completed`
- **WHEN** the abandoned-status migration is applied
- **THEN** existing assignment rows MUST retain their status values and future rows MUST allow status `abandoned`
