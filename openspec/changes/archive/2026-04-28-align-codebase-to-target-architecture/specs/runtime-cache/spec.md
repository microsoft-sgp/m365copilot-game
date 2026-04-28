## ADDED Requirements

### Requirement: Redis cache configuration

The system SHALL support Redis as a production cache dependency for API data that can be safely derived from Azure SQL or configuration.

#### Scenario: Redis is configured in production

- **GIVEN** the application is deployed through the target Azure infrastructure path
- **WHEN** the Function App starts
- **THEN** it MUST receive Redis connection settings through secure runtime configuration and MUST NOT require Redis secrets to be committed to source control

#### Scenario: Redis is optional in local development

- **GIVEN** a developer runs the app locally without Redis settings
- **WHEN** cacheable API endpoints are called
- **THEN** the endpoints MUST continue to work by reading from Azure SQL or local SQL-compatible storage without requiring Redis

### Requirement: Cache-aside read behavior

The system SHALL use cache-aside reads for safe API data while preserving Azure SQL as the source of truth.

#### Scenario: Cache hit returns cached response

- **GIVEN** a valid cached entry exists for a cacheable API request
- **WHEN** the endpoint handles that request
- **THEN** the system MUST return the cached representation without querying Azure SQL for that request

#### Scenario: Cache miss reads from SQL

- **GIVEN** no valid cached entry exists for a cacheable API request
- **WHEN** the endpoint handles that request
- **THEN** the system MUST query Azure SQL using the same authorization and validation rules as the uncached path, return the JSON response, and store a best-effort cache entry with an explicit TTL

#### Scenario: Redis read failure falls back to SQL

- **GIVEN** Redis is configured but unavailable or returns a transient error
- **WHEN** a cacheable endpoint handles a request
- **THEN** the system MUST log the cache failure, read from Azure SQL, and return the correct JSON response without exposing the Redis error to the client

### Requirement: Cache invalidation after mutations

The system SHALL invalidate or refresh cache entries after mutations that affect cached data.

#### Scenario: Campaign settings mutation invalidates campaign cache

- **GIVEN** active campaign data is cached
- **WHEN** an admin creates, updates, activates, clears, or resets campaign-related data that affects the active campaign response
- **THEN** the system MUST invalidate the affected campaign cache keys before subsequent reads are considered fresh

#### Scenario: Organization domain mutation invalidates domain cache

- **GIVEN** organization domain mappings are cached
- **WHEN** an admin creates, updates, deletes, or infers organization/domain mapping data
- **THEN** the system MUST invalidate affected domain-map cache keys before subsequent reads are considered fresh

#### Scenario: Leaderboard mutation invalidates leaderboard cache

- **GIVEN** leaderboard data is cached for a campaign
- **WHEN** a score-bearing gameplay event, keyword submission, revocation, campaign clear, or leaderboard reset changes leaderboard inputs
- **THEN** the system MUST invalidate affected leaderboard cache keys for that campaign before subsequent reads are considered fresh

### Requirement: Cache observability and safety

The system SHALL make cache behavior observable without allowing Redis to become required for correctness.

#### Scenario: Cache operation is logged without sensitive data

- **GIVEN** a cache read, write, or invalidation succeeds or fails
- **WHEN** the operation is logged or traced
- **THEN** telemetry MUST identify the operation class and result without logging JWTs, Redis secrets, OTP codes, player proof text, or other sensitive values

#### Scenario: Cache TTL prevents indefinite staleness

- **GIVEN** a cache entry is written
- **WHEN** the entry is stored in Redis
- **THEN** it MUST include a TTL appropriate for the endpoint so stale derived data cannot persist indefinitely
