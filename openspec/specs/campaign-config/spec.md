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
The system SHALL expose `GET /api/admin/campaigns` to list all campaigns with summary statistics, protected by admin authentication.

#### Scenario: List all campaigns
- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/admin/campaigns` is called
- **THEN** the system MUST return all campaigns with their settings and summary stats (total players, total sessions, total submissions per campaign)

### Requirement: Admin campaign settings update endpoint
The system SHALL expose `PUT /api/admin/campaigns/:id/settings` to update campaign configuration, protected by admin authentication.

#### Scenario: Update campaign settings
- **GIVEN** the admin is authenticated and a campaign exists
- **WHEN** `PUT /api/admin/campaigns/:id/settings` is called with `{ displayName, totalPacks, totalWeeks, copilotUrl, isActive }`
- **THEN** the system MUST update the campaign record and return `{ ok: true }`

#### Scenario: Setting a campaign as active deactivates others
- **GIVEN** campaign A is currently active
- **WHEN** the admin sets campaign B as active via `PUT /api/admin/campaigns/B/settings` with `{ isActive: true }`
- **THEN** the system MUST set campaign A's `is_active` to 0 and campaign B's to 1

### Requirement: Admin campaign creation endpoint
The system SHALL expose `POST /api/admin/campaigns` to create a new campaign, protected by admin authentication.

#### Scenario: Create a new campaign
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/campaigns` is called with `{ id, displayName, totalPacks, totalWeeks, copilotUrl }`
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
