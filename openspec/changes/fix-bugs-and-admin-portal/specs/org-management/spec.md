## ADDED Requirements

### Requirement: Admin organization list endpoint
The system SHALL expose `GET /api/admin/organizations` to list all organizations with their email domain mappings, protected by admin authentication.

#### Scenario: List all organizations with domains
- **GIVEN** the admin is authenticated
- **WHEN** `GET /api/admin/organizations` is called
- **THEN** the system MUST return all organizations with their id, name, and an array of associated email domains

### Requirement: Admin organization creation endpoint
The system SHALL expose `POST /api/admin/organizations` to create a new organization, protected by admin authentication.

#### Scenario: Create a new organization
- **GIVEN** the admin is authenticated
- **WHEN** `POST /api/admin/organizations` is called with `{ name }`
- **THEN** the system MUST insert a new organization record and return `{ ok: true, id: <new-id> }`

#### Scenario: Duplicate organization name
- **GIVEN** an organization with the same name already exists
- **WHEN** creation is attempted
- **THEN** the system MUST return HTTP 409 with `{ ok: false, message: "Organization already exists" }`

### Requirement: Admin organization update endpoint
The system SHALL expose `PUT /api/admin/organizations/:id` to update an organization name, protected by admin authentication.

#### Scenario: Update organization name
- **GIVEN** the admin is authenticated and the organization exists
- **WHEN** `PUT /api/admin/organizations/:id` is called with `{ name }`
- **THEN** the system MUST update the organization name and return `{ ok: true }`

### Requirement: Admin organization deletion endpoint
The system SHALL expose `DELETE /api/admin/organizations/:id` to remove an organization, protected by admin authentication.

#### Scenario: Delete organization with no submissions
- **GIVEN** the organization has no associated submissions
- **WHEN** `DELETE /api/admin/organizations/:id` is called
- **THEN** the system MUST delete the organization and its domain mappings and return `{ ok: true }`

#### Scenario: Delete organization with existing submissions
- **GIVEN** the organization has submissions referencing it
- **WHEN** deletion is attempted
- **THEN** the system MUST return HTTP 409 with `{ ok: false, message: "Cannot delete organization with existing submissions" }`

### Requirement: Admin domain mapping management
The system SHALL expose endpoints to add and remove email domain mappings for an organization, protected by admin authentication.

#### Scenario: Add a domain mapping
- **GIVEN** the admin is authenticated and the organization exists
- **WHEN** `POST /api/admin/organizations/:id/domains` is called with `{ domain }`
- **THEN** the system MUST insert a new org_domains record and return `{ ok: true }`

#### Scenario: Duplicate domain mapping
- **GIVEN** the domain is already mapped to any organization
- **WHEN** adding the domain is attempted
- **THEN** the system MUST return HTTP 409 with `{ ok: false, message: "Domain already mapped" }`

#### Scenario: Remove a domain mapping
- **GIVEN** the admin is authenticated and the domain mapping exists
- **WHEN** `DELETE /api/admin/organizations/:id/domains/:domainId` is called
- **THEN** the system MUST delete the org_domains record and return `{ ok: true }`

### Requirement: Public organization domain map endpoint
The system SHALL expose `GET /api/organizations/domains` to return the email-domain-to-organization mapping for frontend use, without authentication.

#### Scenario: Domain map retrieved
- **GIVEN** organizations and domain mappings exist in the database
- **WHEN** `GET /api/organizations/domains` is called
- **THEN** the system MUST return a JSON object mapping domain strings to organization names (e.g., `{ "nus.edu.sg": "NUS", "schools.gov.sg": "MOE" }`)

#### Scenario: No domain mappings exist
- **GIVEN** the org_domains table is empty
- **WHEN** `GET /api/organizations/domains` is called
- **THEN** the system MUST return an empty object `{}`

### Requirement: Frontend fetches org map from API
The system SHALL fetch the organization domain map from `GET /api/organizations/domains` on load instead of using the hardcoded `orgMap.js`, with hardcoded values as fallback.

#### Scenario: API provides org map
- **GIVEN** the API is reachable and returns domain mappings
- **WHEN** the frontend initializes
- **THEN** the system MUST use the API-provided domain-to-org mapping for email detection in the submission flow

#### Scenario: API unreachable falls back to hardcoded map
- **GIVEN** the API is not reachable
- **WHEN** the frontend initializes
- **THEN** the system MUST fall back to the hardcoded `ORG_MAP` from `orgMap.js` and proceed normally

### Requirement: Admin organization management view
The system SHALL provide an admin view for managing organizations and their domain mappings.

#### Scenario: Admin views organization list
- **GIVEN** the admin is on the organization management view
- **WHEN** the view renders
- **THEN** the system MUST display all organizations with their associated domains in a table with Edit and Delete actions

#### Scenario: Admin adds a new organization
- **GIVEN** the admin is on the organization management view
- **WHEN** the admin clicks "Add Organization", enters a name, and submits
- **THEN** the system MUST call `POST /api/admin/organizations` and refresh the list

#### Scenario: Admin adds a domain to an organization
- **GIVEN** the admin is editing an organization
- **WHEN** the admin enters a new domain and clicks "Add Domain"
- **THEN** the system MUST call `POST /api/admin/organizations/:id/domains` and refresh the domain list
