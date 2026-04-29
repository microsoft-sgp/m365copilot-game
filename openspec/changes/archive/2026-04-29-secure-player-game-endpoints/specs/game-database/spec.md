## ADDED Requirements

### Requirement: Player owner token column

The system SHALL store an optional player session token hash in a `players.owner_token` column so the API can verify that callers presenting a token are the original owner of the player record.

#### Scenario: New schema includes owner_token

- **GIVEN** a fresh database after applying migration `009-player-owner-token.sql`
- **WHEN** the schema is inspected
- **THEN** the `players` table MUST contain a nullable `owner_token NVARCHAR(64)` column

#### Scenario: Migration is idempotent

- **GIVEN** a database where `players.owner_token` already exists
- **WHEN** migration `009-player-owner-token.sql` is re-run
- **THEN** the migration MUST succeed without altering existing data and MUST NOT raise an error

#### Scenario: Filtered index on populated tokens

- **GIVEN** migration `009-player-owner-token.sql` has been applied
- **WHEN** the schema is inspected
- **THEN** a filtered index `IX_players_owner_token` MUST exist over `players(owner_token) WHERE owner_token IS NOT NULL` so token lookups are O(log n) without indexing the legacy null rows

### Requirement: Owner token storage format

The system SHALL store only the hex-encoded SHA-256 digest of the player session token in `players.owner_token` and MUST NOT store the raw token.

#### Scenario: Stored token is a hex digest

- **GIVEN** a player session token has been issued for a new player
- **WHEN** the corresponding `players` row is inspected
- **THEN** `owner_token` MUST be exactly 64 characters of `[0-9a-f]` and MUST NOT equal the raw token returned to the client

#### Scenario: Legacy rows remain valid

- **GIVEN** an existing database contains player records inserted before migration `009`
- **WHEN** migration `009-player-owner-token.sql` is applied
- **THEN** existing rows MUST remain queryable with `owner_token IS NULL`, and the API SHALL be free to populate `owner_token` on the next authenticated `POST /api/sessions` for that email
