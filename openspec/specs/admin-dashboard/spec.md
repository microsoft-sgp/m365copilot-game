# admin-dashboard

## Purpose

Defines the admin dashboard and CSV export endpoints for campaign administrators: viewing game session and submission data, engagement metrics, and exporting reports, all protected by a static password.

## Requirements

### Requirement: Admin dashboard endpoint

The system SHALL expose `GET /api/portal-api/dashboard` to return campaign gameplay and scoring data sourced from progression-based scoring records, protected by JWT-based authentication or the static admin key.

#### Scenario: Authorized admin views dashboard data (JWT)

- **GIVEN** the request includes a valid `Authorization: Bearer <jwt>` header with a non-expired admin JWT
- **WHEN** the admin sends `GET /api/portal-api/dashboard?campaign=APR26`
- **THEN** the system MUST return dashboard summaries and lists consistent with progression-based leaderboard scoring

#### Scenario: Authorized admin views dashboard data (legacy key)

- **GIVEN** the request includes a valid `X-Admin-Key` header matching the configured admin password
- **WHEN** the admin sends `GET /api/portal-api/dashboard?campaign=APR26`
- **THEN** the system MUST return the same progression-consistent dashboard data (backward compatible)

#### Scenario: Unauthorized access attempt

- **GIVEN** the request has neither a valid JWT nor a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/portal-api/dashboard`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: CSV export endpoint

The system SHALL expose `GET /api/portal-api/export` to download campaign scoring data consistent with progression-based leaderboard records, protected by JWT-based authentication or the static admin key.

#### Scenario: Authorized CSV export (JWT)

- **GIVEN** the request includes a valid admin JWT
- **WHEN** the admin sends `GET /api/portal-api/export?campaign=APR26`
- **THEN** the system MUST return a CSV file containing progression-scoring-compatible rows for campaign reporting

#### Scenario: Authorized CSV export (legacy key)

- **GIVEN** the request includes a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/portal-api/export?campaign=APR26`
- **THEN** the system MUST return the same progression-consistent CSV file (backward compatible)

### Requirement: Dashboard parity with player leaderboard

The system SHALL ensure admin score totals for a campaign match the same scoring source used by `GET /api/leaderboard`.

#### Scenario: Admin and player leaderboard parity

- **GIVEN** progression scoring records exist for a campaign
- **WHEN** admin dashboard summary and player leaderboard are both queried for that campaign
- **THEN** organization ranking and score totals MUST be derived from the same scoring source and remain numerically consistent

### Requirement: Admin score event achievements display

The system SHALL display Recent Score Events in admin-facing achievement language while preserving the underlying progression event data for API and export compatibility.

#### Scenario: Line score event displays as completed line

- **GIVEN** the dashboard API returns a score event with `event_type` `line_won` and an `event_key` such as `R1`, `C2`, or `D1`
- **WHEN** the admin dashboard renders Recent Score Events
- **THEN** the system MUST display the event as a line completion achievement with a corresponding task-style detail such as `Task 1` or `Task 2` instead of displaying `line_won` or board-geometry terms such as row, column, or diagonal

#### Scenario: Weekly score event displays as weekly award

- **GIVEN** the dashboard API returns a score event with `event_type` `weekly_won` and an `event_key` such as `W1`
- **WHEN** the admin dashboard renders Recent Score Events
- **THEN** the system MUST display the event as a weekly award achievement with the corresponding week detail instead of displaying `weekly_won`

#### Scenario: Legacy score event displays as legacy submission

- **GIVEN** the dashboard API returns a score event row without an `event_type`
- **WHEN** the admin dashboard renders Recent Score Events
- **THEN** the system MUST display the event as a legacy keyword submission instead of displaying a raw fallback code

#### Scenario: Raw score event data remains exportable

- **GIVEN** progression score records include raw event type and event key values
- **WHEN** the admin downloads the CSV export
- **THEN** the system MUST preserve the existing raw export columns and values for audit and reporting compatibility

### Requirement: Admin password stored as app setting

The system SHALL read the admin password from an Azure Functions App Setting (environment variable), never from source code. Additional app settings SHALL be required for JWT signing and admin email allow-list.

#### Scenario: Password configured via app setting

- **GIVEN** the App Setting `ADMIN_KEY` is configured in the Function App
- **WHEN** the admin endpoints compare the `X-Admin-Key` header value
- **THEN** the system MUST compare against the `ADMIN_KEY` environment variable using a constant-time comparison

#### Scenario: JWT secret configured via app setting

- **GIVEN** the App Setting `JWT_SECRET` is configured
- **WHEN** admin JWT tokens are signed or verified
- **THEN** the system MUST use the `JWT_SECRET` environment variable

#### Scenario: Admin emails configured via app setting

- **GIVEN** the App Setting `ADMIN_EMAILS` is configured with a comma-separated list of emails
- **WHEN** an OTP request is made
- **THEN** the system MUST validate the email against this allow-list

### Requirement: Admin organization CRUD endpoints

The system SHALL expose CRUD endpoints for organizations and domain mappings under `/api/portal-api/organizations`, protected by admin authentication.

#### Scenario: List organizations

- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/portal-api/organizations` is called
- **THEN** the system MUST return all organizations with their id, name, and associated domain mappings

#### Scenario: Create organization

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/organizations` is called with `{ name }`
- **THEN** the system MUST insert a new organization and return `{ ok: true, id: <new-id> }`

#### Scenario: Update organization

- **GIVEN** the admin is authenticated and the organization exists
- **WHEN** `PUT /api/portal-api/organizations/:id` is called with `{ name }`
- **THEN** the system MUST update the organization name and return `{ ok: true }`

#### Scenario: Delete organization

- **GIVEN** the admin is authenticated and the organization has no submissions
- **WHEN** `DELETE /api/portal-api/organizations/:id` is called
- **THEN** the system MUST delete the organization and its domain mappings and return `{ ok: true }`

#### Scenario: Add domain mapping

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/organizations/:id/domains` is called with `{ domain }`
- **THEN** the system MUST insert a new org_domains record and return `{ ok: true }`

#### Scenario: Remove domain mapping

- **GIVEN** the admin is authenticated
- **WHEN** `DELETE /api/portal-api/organizations/:id/domains/:domainId` is called
- **THEN** the system MUST delete the org_domains record and return `{ ok: true }`

### Requirement: Admin campaign management endpoints

The system SHALL expose CRUD endpoints for campaigns under `/api/portal-api/campaigns`, protected by admin authentication.

#### Scenario: List campaigns

- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/portal-api/campaigns` is called
- **THEN** the system MUST return all campaigns with settings and summary stats

#### Scenario: Create campaign

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns` is called with campaign settings
- **THEN** the system MUST insert a new campaign record and return `{ ok: true }`

#### Scenario: Update campaign settings

- **GIVEN** the admin is authenticated
- **WHEN** `PUT /api/portal-api/campaigns/:id/settings` is called with updated values
- **THEN** the system MUST update the campaign and return `{ ok: true }`

### Requirement: Admin player management endpoints

The system SHALL expose endpoints for player search, detail view, and management under `/api/portal-api/players`, protected by admin authentication.

#### Scenario: Search players

- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/portal-api/players?q=<query>` is called
- **THEN** the system MUST return matching players (by email or name, case-insensitive, limit 50)

#### Scenario: Get player detail

- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/portal-api/players/:id` is called
- **THEN** the system MUST return the player with all game sessions and submissions

#### Scenario: Delete player

- **GIVEN** the admin is authenticated
- **WHEN** `DELETE /api/portal-api/players/:id` is called
- **THEN** the system MUST delete the player and cascade to sessions, events, and submissions, and return `{ ok: true }`

### Requirement: Admin submission revocation endpoint

The system SHALL expose `DELETE /api/portal-api/submissions/:id` to revoke a keyword submission, protected by admin authentication.

#### Scenario: Revoke submission

- **GIVEN** the admin is authenticated and the submission exists
- **WHEN** `DELETE /api/portal-api/submissions/:id` is called
- **THEN** the system MUST delete the submission record and return `{ ok: true }`

#### Scenario: Revoke nonexistent submission

- **GIVEN** the submission ID does not exist
- **WHEN** `DELETE /api/portal-api/submissions/:id` is called
- **THEN** the system MUST return HTTP 404 with `{ ok: false, message: "Submission not found" }`

### Requirement: Admin campaign data clearing endpoints

The system SHALL expose endpoints for campaign data operations under `/api/portal-api/campaigns/:id/`, protected by admin authentication.

#### Scenario: Clear campaign data

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns/:id/clear` is called
- **THEN** the system MUST delete all tile_events, game_sessions, and submissions for that campaign (preserving players and organizations) and return counts of deleted records

#### Scenario: Reset leaderboard

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns/:id/reset-leaderboard` is called
- **THEN** the system MUST delete all submissions for that campaign and return the count of deleted submissions

### Requirement: Admin session progress display

The system SHALL display Recent Sessions progress in admin-facing task and award language while preserving the underlying dashboard API fields for compatibility.

#### Scenario: Recent Sessions displays task progress

- **GIVEN** the dashboard API returns a recent session with `tiles_cleared` set to `3`
- **WHEN** the admin dashboard renders Recent Sessions
- **THEN** the system MUST display the session progress using a `Tasks` label with `3/9` task progress instead of a `Tiles` label

#### Scenario: Recent Sessions displays award progress

- **GIVEN** the dashboard API returns a recent session with `lines_won` set to `1`
- **WHEN** the admin dashboard renders Recent Sessions
- **THEN** the system MUST display the line-award progress using an admin-facing `Awards` label with explicit `1/8` total context instead of a `Lines` label with only the raw count

#### Scenario: Dashboard summary uses task language

- **GIVEN** the dashboard summary includes `avgTilesCleared`
- **WHEN** the admin dashboard renders summary metrics
- **THEN** the system MUST label the average completed-board metric as tasks rather than tiles

#### Scenario: Session API compatibility is preserved

- **GIVEN** the dashboard API returns existing session fields such as `tiles_cleared`, `lines_won`, `pack_id`, and `last_active_at`
- **WHEN** the admin dashboard renders Recent Sessions
- **THEN** the system MUST use those existing fields without requiring a backend response contract change
