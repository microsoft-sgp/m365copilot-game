## ADDED Requirements

### Requirement: Admin dashboard endpoint
The system SHALL expose `GET /api/admin/dashboard` to return game session and submission data for campaign administrators, protected by a static password.

#### Scenario: Authorized admin views dashboard data
- **GIVEN** the request includes a valid `X-Admin-Key` header matching the configured admin password
- **WHEN** the admin sends `GET /api/admin/dashboard?campaign=APR26`
- **THEN** the system MUST return `{ sessions: [...], submissions: [...], summary: { totalPlayers, totalSessions, totalSubmissions, avgTilesCleared, topOrg } }`

#### Scenario: Unauthorized access attempt
- **GIVEN** the request is missing the `X-Admin-Key` header or the value does not match
- **WHEN** the admin sends `GET /api/admin/dashboard`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

#### Scenario: Dashboard summary includes engagement metrics
- **GIVEN** multiple game sessions and submissions exist
- **WHEN** the authorized admin requests the dashboard
- **THEN** the summary MUST include total unique players, total game sessions started, total submissions, average tiles cleared per session, and the top-scoring organization

### Requirement: CSV export endpoint
The system SHALL expose `GET /api/admin/export` to download submission data as a CSV file for campaign reporting, protected by a static password.

#### Scenario: Authorized CSV export
- **GIVEN** the request includes a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/admin/export?campaign=APR26`
- **THEN** the system MUST return a CSV file with headers `org,player_name,email,keyword,submitted_at` and one row per submission, with `Content-Type: text/csv` and a `Content-Disposition` header for download

#### Scenario: CSV export with no submissions
- **GIVEN** no submissions exist for the requested campaign
- **WHEN** the admin requests the CSV export
- **THEN** the system MUST return a CSV file with only the header row

#### Scenario: Unauthorized CSV export attempt
- **GIVEN** the request is missing or has an invalid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/admin/export`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: Admin password stored as app setting
The system SHALL read the admin password from an Azure Functions App Setting (environment variable), never from source code.

#### Scenario: Password configured via app setting
- **GIVEN** the App Setting `ADMIN_KEY` is configured in the Function App
- **WHEN** the admin endpoints compare the `X-Admin-Key` header value
- **THEN** the system MUST compare against the `ADMIN_KEY` environment variable using a constant-time comparison

#### Scenario: Password not configured
- **GIVEN** the `ADMIN_KEY` App Setting is not set or is empty
- **WHEN** any request hits an admin endpoint
- **THEN** the system MUST return HTTP 500 with `{ ok: false, message: "Admin access not configured" }`
