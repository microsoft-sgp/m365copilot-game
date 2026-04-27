## ADDED Requirements

### Requirement: Player organization attribution column
The system SHALL store a nullable player organization reference so score-bearing events can attribute public/free-mail users and previously resolved company users without globally mapping shared mail domains.

#### Scenario: Player created with inferred company organization
- **GIVEN** a new player starts a session with `alex@contoso.com`
- **WHEN** the backend infers or finds organization `Contoso`
- **THEN** the players table MUST store a foreign-key reference from that player to the `Contoso` organization

#### Scenario: Player created with public email organization
- **GIVEN** a new player starts a session with `alex@gmail.com` and organization `Contoso`
- **WHEN** the backend creates or reuses the player record
- **THEN** the players table MUST store a foreign-key reference from that player to the `Contoso` organization without adding an `org_domains` mapping for `gmail.com`

#### Scenario: Existing players can remain without organization
- **GIVEN** an existing database contains player records from before organization attribution was added
- **WHEN** the migration is applied
- **THEN** the players table MUST allow null organization references so existing player records remain valid

### Requirement: Organization attribution migration
The system SHALL provide a numbered SQL migration that adds player organization attribution without data loss.

#### Scenario: Migration adds nullable foreign key
- **GIVEN** an existing database initialized with prior migrations
- **WHEN** the organization attribution migration runs
- **THEN** it MUST add a nullable organization reference to players and enforce referential integrity to `organizations(id)`

#### Scenario: Migration backfills mapped email domains
- **GIVEN** existing players have email domains already present in `org_domains`
- **WHEN** the organization attribution migration runs
- **THEN** it MUST backfill those players' organization references from the existing domain mappings

#### Scenario: Migration preserves historical progression scores
- **GIVEN** existing `progression_scores` records may have null `org_id`
- **WHEN** the organization attribution migration runs
- **THEN** it MUST NOT delete or corrupt historical scoring records

### Requirement: Inferred organization data uses existing organization tables
The system SHALL store inferred company organizations in `organizations` and their non-public email domains in `org_domains` using the existing uniqueness constraints.

#### Scenario: Inferred organization reuses existing unique name
- **GIVEN** organization `Contoso` already exists without a `contoso.com` domain mapping
- **WHEN** the backend infers `Contoso` from `alex@contoso.com`
- **THEN** it MUST reuse the existing organization row and add only the missing non-public domain mapping

#### Scenario: Inferred domain uniqueness is enforced
- **GIVEN** `contoso.com` is already mapped to an organization
- **WHEN** another request attempts to infer or add `contoso.com`
- **THEN** the database MUST prevent duplicate domain mappings and the backend MUST resolve to the existing mapping