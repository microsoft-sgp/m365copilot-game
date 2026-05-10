## MODIFIED Requirements

### Requirement: Admin player lookup

The system SHALL provide a player search and detail view in the admin portal for looking up players by email or nickname.

#### Scenario: Admin searches for a player by email or nickname

- **GIVEN** the admin is on the player management view
- **WHEN** the admin enters a search query
- **THEN** the system MUST call `GET /api/portal-api/players?q=<query>` and display matching players with their nickname, email, session count, and submission count

#### Scenario: Admin views player detail

- **GIVEN** the admin has found a player in search results
- **WHEN** the admin clicks on a player row
- **THEN** the system MUST call `GET /api/portal-api/players/:id` and display the player's full detail including nickname, all sessions with progress, and all submissions with keywords

### Requirement: Admin player search endpoint

The system SHALL expose `GET /api/portal-api/players` to search players by email or nickname, protected by admin authentication.

#### Scenario: Search players by query

- **GIVEN** the admin provides a query parameter `q`
- **WHEN** `GET /api/portal-api/players?q=alice` is called
- **THEN** the system MUST return players whose email or canonical `player_name` nickname contains the query string (case-insensitive), limited to 50 results

#### Scenario: Get player detail

- **GIVEN** a valid player ID
- **WHEN** `GET /api/portal-api/players/:id` is called
- **THEN** the system MUST return the player record with nickname-compatible identity fields and all associated game sessions and submissions
