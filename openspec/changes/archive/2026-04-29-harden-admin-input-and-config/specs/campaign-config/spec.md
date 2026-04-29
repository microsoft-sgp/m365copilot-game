## ADDED Requirements

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
