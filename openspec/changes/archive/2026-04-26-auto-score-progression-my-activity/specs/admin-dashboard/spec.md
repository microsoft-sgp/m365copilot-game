## MODIFIED Requirements

### Requirement: Admin dashboard endpoint
The system SHALL expose `GET /api/admin/dashboard` to return campaign gameplay and scoring data sourced from progression-based scoring records, protected by JWT-based authentication or the static admin key.

#### Scenario: Authorized admin views dashboard data (JWT)
- **GIVEN** the request includes a valid `Authorization: Bearer <jwt>` header with a non-expired admin JWT
- **WHEN** the admin sends `GET /api/admin/dashboard?campaign=APR26`
- **THEN** the system MUST return dashboard summaries and lists consistent with progression-based leaderboard scoring

#### Scenario: Authorized admin views dashboard data (legacy key)
- **GIVEN** the request includes a valid `X-Admin-Key` header matching the configured admin password
- **WHEN** the admin sends `GET /api/admin/dashboard?campaign=APR26`
- **THEN** the system MUST return the same progression-consistent dashboard data (backward compatible)

#### Scenario: Unauthorized access attempt
- **GIVEN** the request has neither a valid JWT nor a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/admin/dashboard`
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: CSV export endpoint
The system SHALL expose `GET /api/admin/export` to download campaign scoring data consistent with progression-based leaderboard records, protected by JWT-based authentication or the static admin key.

#### Scenario: Authorized CSV export (JWT)
- **GIVEN** the request includes a valid admin JWT
- **WHEN** the admin sends `GET /api/admin/export?campaign=APR26`
- **THEN** the system MUST return a CSV file containing progression-scoring-compatible rows for campaign reporting

#### Scenario: Authorized CSV export (legacy key)
- **GIVEN** the request includes a valid `X-Admin-Key` header
- **WHEN** the admin sends `GET /api/admin/export?campaign=APR26`
- **THEN** the system MUST return the same progression-consistent CSV file (backward compatible)

## ADDED Requirements

### Requirement: Dashboard parity with player leaderboard
The system SHALL ensure admin score totals for a campaign match the same scoring source used by `GET /api/leaderboard`.

#### Scenario: Admin and player leaderboard parity
- **GIVEN** progression scoring records exist for a campaign
- **WHEN** admin dashboard summary and player leaderboard are both queried for that campaign
- **THEN** organization ranking and score totals MUST be derived from the same scoring source and remain numerically consistent
