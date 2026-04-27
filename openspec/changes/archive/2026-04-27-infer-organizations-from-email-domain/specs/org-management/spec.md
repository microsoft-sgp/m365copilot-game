## ADDED Requirements

### Requirement: Inferred company domain mappings
The system SHALL infer and persist organization domain mappings for non-public email domains that do not already exist in `org_domains`.

#### Scenario: Existing domain mapping remains authoritative
- **GIVEN** `org_domains` maps `smu.edu.sg` to `SMU`
- **WHEN** a player uses `ada@smu.edu.sg`
- **THEN** the system MUST resolve the organization as `SMU` without creating a new inferred organization

#### Scenario: Unknown company domain is inferred
- **GIVEN** no domain mapping exists for `contoso.com`
- **WHEN** a player uses `alex@contoso.com`
- **THEN** the system MUST create or reuse an organization named from the company domain and MUST create an `org_domains` mapping from `contoso.com` to that organization

#### Scenario: Concurrent inference reuses existing mapping
- **GIVEN** two players from `contoso.com` start at nearly the same time
- **WHEN** both requests try to infer the company domain
- **THEN** the system MUST end with one `org_domains` mapping for `contoso.com` and both players MUST resolve to the same organization

### Requirement: Public email domains are excluded from global mappings
The system SHALL treat shared public/free-mail domains as non-identifying domains and MUST NOT create global `org_domains` mappings for them.

#### Scenario: Public email domain does not create mapping
- **GIVEN** `gmail.com` is configured as a public/free-mail domain
- **WHEN** a player uses `alex@gmail.com` and enters organization `Contoso`
- **THEN** the system MUST resolve the player to `Contoso` and MUST NOT create an `org_domains` row for `gmail.com`

#### Scenario: Public domain appears in public domain map only if explicitly mapped by admin
- **GIVEN** no admin has mapped `gmail.com` to an organization
- **WHEN** `GET /api/organizations/domains` is called
- **THEN** the response MUST NOT include a generated `gmail.com` mapping

### Requirement: Admin correction of inferred organizations
The system SHALL expose inferred organizations and non-public inferred domain mappings through the existing admin organization management endpoints.

#### Scenario: Admin renames inferred organization
- **GIVEN** the system inferred organization `Contoso` from `contoso.com`
- **WHEN** an admin updates the organization name through `PUT /api/portal-api/organizations/:id`
- **THEN** future leaderboard and organization list responses MUST use the updated organization name while preserving the domain mapping

#### Scenario: Admin removes inferred domain mapping
- **GIVEN** an inferred domain mapping exists for `contoso.com`
- **WHEN** an admin removes the mapping through `DELETE /api/portal-api/organizations/:id/domains/:domainId`
- **THEN** the mapping MUST be removed using the same behavior as manually added mappings