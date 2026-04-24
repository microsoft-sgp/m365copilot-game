## ADDED Requirements

### Requirement: Admin organization CRUD endpoints
The system SHALL expose CRUD endpoints for organizations and domain mappings under `/api/admin/organizations`, protected by admin authentication.

#### Scenario: List organizations
- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/admin/organizations` is called
- **THEN** the system MUST return all organizations with their id, name, and associated domain mappings

#### Scenario: Create organization
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/organizations` is called with `{ name }`
- **THEN** the system MUST insert a new organization and return `{ ok: true, id: <new-id> }`

#### Scenario: Update organization
- **GIVEN** the admin is authenticated and the organization exists
- **WHEN** `PUT /api/admin/organizations/:id` is called with `{ name }`
- **THEN** the system MUST update the organization name and return `{ ok: true }`

#### Scenario: Delete organization
- **GIVEN** the admin is authenticated and the organization has no submissions
- **WHEN** `DELETE /api/admin/organizations/:id` is called
- **THEN** the system MUST delete the organization and its domain mappings and return `{ ok: true }`

#### Scenario: Add domain mapping
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/organizations/:id/domains` is called with `{ domain }`
- **THEN** the system MUST insert a new org_domains record and return `{ ok: true }`

#### Scenario: Remove domain mapping
- **GIVEN** the admin is authenticated
- **WHEN** `DELETE /api/admin/organizations/:id/domains/:domainId` is called
- **THEN** the system MUST delete the org_domains record and return `{ ok: true }`

### Requirement: Admin campaign management endpoints
The system SHALL expose CRUD endpoints for campaigns under `/api/admin/campaigns`, protected by admin authentication.

#### Scenario: List campaigns
- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/admin/campaigns` is called
- **THEN** the system MUST return all campaigns with settings and summary stats

#### Scenario: Create campaign
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/campaigns` is called with campaign settings
- **THEN** the system MUST insert a new campaign record and return `{ ok: true }`

#### Scenario: Update campaign settings
- **GIVEN** the admin is authenticated
- **WHEN** `PUT /api/admin/campaigns/:id/settings` is called with updated values
- **THEN** the system MUST update the campaign and return `{ ok: true }`

### Requirement: Admin player management endpoints
The system SHALL expose endpoints for player search, detail view, and management under `/api/admin/players`, protected by admin authentication.

#### Scenario: Search players
- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/admin/players?q=<query>` is called
- **THEN** the system MUST return matching players (by email or name, case-insensitive, limit 50)

#### Scenario: Get player detail
- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/admin/players/:id` is called
- **THEN** the system MUST return the player with all game sessions and submissions

#### Scenario: Delete player
- **GIVEN** the admin is authenticated
- **WHEN** `DELETE /api/admin/players/:id` is called
- **THEN** the system MUST delete the player and cascade to sessions, events, and submissions, and return `{ ok: true }`

### Requirement: Admin submission revocation endpoint
The system SHALL expose `DELETE /api/admin/submissions/:id` to revoke a keyword submission, protected by admin authentication.

#### Scenario: Revoke submission
- **GIVEN** the admin is authenticated and the submission exists
- **WHEN** `DELETE /api/admin/submissions/:id` is called
- **THEN** the system MUST delete the submission record and return `{ ok: true }`

#### Scenario: Revoke nonexistent submission
- **GIVEN** the submission ID does not exist
- **WHEN** `DELETE /api/admin/submissions/:id` is called
- **THEN** the system MUST return HTTP 404 with `{ ok: false, message: "Submission not found" }`

### Requirement: Admin campaign data clearing endpoints
The system SHALL expose endpoints for campaign data operations under `/api/admin/campaigns/:id/`, protected by admin authentication.

#### Scenario: Clear campaign data
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/campaigns/:id/clear` is called
- **THEN** the system MUST delete all tile_events, game_sessions, and submissions for that campaign (preserving players and organizations) and return counts of deleted records

#### Scenario: Reset leaderboard
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/campaigns/:id/reset-leaderboard` is called
- **THEN** the system MUST delete all submissions for that campaign and return the count of deleted submissions

## MODIFIED Requirements

### Requirement: Admin dashboard endpoint
The system SHALL expose `GET /api/admin/dashboard` to return game session and submission data for campaign administrators, protected by JWT-based authentication or the static admin key.

#### Scenario: Authorized admin views dashboard data (JWT)
- **GIVEN** the request includes a valid `Authorization: Bearer <jwt>` header with a non-expired admin JWT
- **WHEN** the admin sends `GET /api/admin/dashboard?campaign=APR26`
- **THEN** the system MUST return `{ sessions: [...], submissions: [...], summary: { totalPlayers, totalSessions, totalSubmissions, avgTilesCleared, topOrg } }`

#### Scenario: Authorized admin views dashboard data (legacy key)
- **GIVEN** the request includes a valid `X-Admin-Key` header matching the configured admin password
- **WHEN** the admin sends `GET /api/admin/dashboard?campaign=APR26`
- **THEN** the system MUST return the same dashboard data (backward compatible)

#### Scenario: Unauthorized access attempt
- **GIVEN** the request has neither a valid JWT nor a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/admin/dashboard`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: CSV export endpoint
The system SHALL expose `GET /api/admin/export` to download submission data as a CSV file, protected by JWT-based authentication or the static admin key.

#### Scenario: Authorized CSV export (JWT)
- **GIVEN** the request includes a valid admin JWT
- **WHEN** the admin sends `GET /api/admin/export?campaign=APR26`
- **THEN** the system MUST return a CSV file with headers `org,player_name,email,keyword,submitted_at`

#### Scenario: Authorized CSV export (legacy key)
- **GIVEN** the request includes a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/admin/export?campaign=APR26`
- **THEN** the system MUST return the same CSV file (backward compatible)

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
