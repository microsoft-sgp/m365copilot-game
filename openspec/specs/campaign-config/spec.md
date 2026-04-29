# campaign-config

## Purpose

Defines campaign configuration storage in the database and API endpoints for managing and retrieving campaign settings.

## Requirements

### Requirement: Campaigns database table

The system SHALL store campaign configuration in a `campaigns` table, replacing hardcoded constants in the frontend.

#### Scenario: Campaign record exists

- **GIVEN** the database is initialized with the migration
- **WHEN** a query fetches the active campaign
- **THEN** the system MUST return the campaign's id, display_name, total_packs, total_weeks, copilot_url, and is_active flag

### Requirement: Active campaign public endpoint

The system SHALL expose `GET /api/campaigns/active` to return the active campaign configuration for the frontend, without authentication.

#### Scenario: Active campaign retrieved

- **GIVEN** a campaign with `is_active = 1` exists in the database
- **WHEN** `GET /api/campaigns/active` is called
- **THEN** the system MUST return `{ campaignId, displayName, totalPacks, totalWeeks, copilotUrl }`

#### Scenario: No active campaign

- **GIVEN** no campaign has `is_active = 1`
- **WHEN** `GET /api/campaigns/active` is called
- **THEN** the system MUST return HTTP 404 with `{ ok: false, message: "No active campaign" }`

### Requirement: Admin campaign list endpoint

The system SHALL expose `GET /api/portal-api/campaigns` to list all campaigns with summary statistics, protected by admin authentication.

#### Scenario: List all campaigns

- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/portal-api/campaigns` is called
- **THEN** the system MUST return all campaigns with their settings and summary stats (total players, total sessions, total submissions per campaign)

### Requirement: Admin campaign settings update endpoint

The system SHALL expose `PUT /api/portal-api/campaigns/:id/settings` to update campaign configuration, protected by admin authentication.

#### Scenario: Update campaign settings

- **GIVEN** the admin is authenticated and a campaign exists
- **WHEN** `PUT /api/portal-api/campaigns/:id/settings` is called with `{ displayName, totalPacks, totalWeeks, copilotUrl, isActive }`
- **THEN** the system MUST update the campaign record and return `{ ok: true }`

#### Scenario: Setting a campaign as active deactivates others

- **GIVEN** campaign A is currently active
- **WHEN** the admin sets campaign B as active via `PUT /api/portal-api/campaigns/B/settings` with `{ isActive: true }`
- **THEN** the system MUST set campaign A's `is_active` to 0 and campaign B's to 1

### Requirement: Admin campaign creation endpoint

The system SHALL expose `POST /api/portal-api/campaigns` to create a new campaign, protected by admin authentication.

#### Scenario: Create a new campaign

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns` is called with `{ id, displayName, totalPacks, totalWeeks, copilotUrl }`
- **THEN** the system MUST insert a new campaign record and return `{ ok: true }`

#### Scenario: Duplicate campaign ID

- **GIVEN** a campaign with the same ID already exists
- **WHEN** creation is attempted
- **THEN** the system MUST return HTTP 409 with `{ ok: false, message: "Campaign already exists" }`

### Requirement: Frontend fetches campaign config from API

The system SHALL fetch active campaign configuration from `GET /api/campaigns/active` on load instead of using hardcoded constants, with hardcoded values as fallback.

#### Scenario: API provides campaign config

- **GIVEN** the API is reachable and returns active campaign data
- **WHEN** the frontend initializes
- **THEN** the system MUST use the API-provided values for campaignId, totalPacks, totalWeeks, and copilotUrl

#### Scenario: API unreachable falls back to hardcoded values

- **GIVEN** the API is not reachable
- **WHEN** the frontend initializes
- **THEN** the system MUST fall back to the hardcoded values in `constants.js` and proceed normally

### Requirement: Server-side validation of campaign URL and counts

The system SHALL validate `copilotUrl`, `totalPacks`, and `totalWeeks` server-side on every admin campaign create or update endpoint, rejecting unsafe URL schemes and out-of-range counts before any database write.

#### Scenario: Non-https copilotUrl is rejected on create

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns` is called with `copilotUrl = "javascript:alert(1)"`, `copilotUrl = "http://example.com/chat"`, or `copilotUrl = "data:text/html,…"`
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "copilotUrl must be an https:// URL" }` and MUST NOT insert a campaign row

#### Scenario: Non-https copilotUrl is rejected on update

- **GIVEN** the admin is authenticated and a campaign exists
- **WHEN** `PUT /api/portal-api/campaigns/:id/settings` is called with a non-empty `copilotUrl` that is not an `https://` URL
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "copilotUrl must be an https:// URL" }` and MUST NOT update the campaign row

#### Scenario: Empty or omitted copilotUrl preserves existing behavior

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns` is called without `copilotUrl` (omitted or empty string)
- **THEN** the system MUST insert the campaign with the default `https://m365.cloud.microsoft/chat` value
- **AND WHEN** `PUT /api/portal-api/campaigns/:id/settings` is called without `copilotUrl`
- **THEN** the system MUST leave the existing `copilot_url` column unchanged (`COALESCE(@copilotUrl, copilot_url)` semantics)

#### Scenario: Out-of-range totalPacks is rejected

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns` or `PUT /api/portal-api/campaigns/:id/settings` is called with `totalPacks <= 0` or `totalPacks > 10000`
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "totalPacks must be between 1 and 10000" }` and MUST NOT write to the campaign row

#### Scenario: Out-of-range totalWeeks is rejected

- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/portal-api/campaigns` or `PUT /api/portal-api/campaigns/:id/settings` is called with `totalWeeks <= 0` or `totalWeeks > 52`
- **THEN** the system MUST return HTTP 400 with `{ ok: false, message: "totalWeeks must be between 1 and 52" }` and MUST NOT write to the campaign row
