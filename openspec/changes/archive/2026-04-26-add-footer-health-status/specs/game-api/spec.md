## ADDED Requirements

### Requirement: Health probe endpoint
The system SHALL expose `GET /api/health` as an unauthenticated endpoint that reports overall service health, API process status, and database connectivity. The endpoint SHALL always respond with HTTP 200 and a structured JSON body so callers can distinguish between "API responded with degraded dependencies" and "API unreachable" purely from network success vs. body content. The response body SHALL be free of business data, version strings, environment names, and other information not required for a binary-style health classification.

#### Scenario: Healthy response when API and database are reachable
- **GIVEN** the API process is running and the database accepts a lightweight probe query
- **WHEN** a client sends `GET /api/health`
- **THEN** the system MUST return HTTP 200 with `{ ok: true, status: "healthy", api: "up", database: "up", checkedAt: <ISO-8601 UTC timestamp> }`

#### Scenario: Degraded response when database probe fails
- **GIVEN** the API process is running but the database probe throws an error or times out
- **WHEN** a client sends `GET /api/health`
- **THEN** the system MUST return HTTP 200 with `{ ok: false, status: "degraded", api: "up", database: "down", checkedAt: <ISO-8601 UTC timestamp> }` and MUST NOT include the underlying error message or stack trace in the response body

#### Scenario: Endpoint requires no authentication
- **GIVEN** no authentication credentials are provided
- **WHEN** a client sends `GET /api/health`
- **THEN** the system MUST process the request and return a health response (HTTP 200) without requiring an admin key, JWT, or session

#### Scenario: Database probe uses a minimal query
- **GIVEN** the health endpoint is invoked
- **WHEN** the system probes the database
- **THEN** the probe MUST use a constant-cost query (e.g., `SELECT 1`) executed against the shared connection pool, and MUST NOT read from business tables
