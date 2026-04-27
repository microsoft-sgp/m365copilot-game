## ADDED Requirements

### Requirement: Shared organization resolution
The system SHALL resolve a player's organization consistently across session creation, progression event scoring, and legacy keyword submission using mapped domains, manually supplied public-email organization names, or inferred company domains.

#### Scenario: Known mapped domain resolves to existing organization
- **GIVEN** `org_domains` maps `nus.edu.sg` to `NUS`
- **WHEN** the backend resolves organization for `ada@nus.edu.sg`
- **THEN** it MUST return the existing `NUS` organization and MUST NOT create a duplicate organization or domain mapping

#### Scenario: Unknown non-public company domain resolves by inference
- **GIVEN** no domain mapping exists for `contoso.com`
- **WHEN** the backend resolves organization for `alex@contoso.com`
- **THEN** it MUST create or reuse an inferred organization for `Contoso`, create or reuse the `contoso.com` domain mapping, and return that organization

#### Scenario: Public email resolves from supplied organization
- **GIVEN** `gmail.com` is configured as a public/free-mail domain
- **WHEN** `POST /api/sessions` receives `alex@gmail.com` with organization `Contoso`
- **THEN** the backend MUST create or reuse organization `Contoso`, store it as the player's organization, and MUST NOT create an `org_domains` mapping for `gmail.com`

#### Scenario: Public email without organization is rejected for session creation
- **GIVEN** `gmail.com` is configured as a public/free-mail domain
- **WHEN** `POST /api/sessions` receives `alex@gmail.com` without an organization name
- **THEN** the backend MUST return HTTP 400 with `{ ok: false, message: "..." }`

### Requirement: Progression scoring uses resolved player organization
The system SHALL persist score-bearing progression records with the player's resolved organization whenever organization context is available.

#### Scenario: Company domain scores under inferred organization
- **GIVEN** a player with email `alex@contoso.com` starts a board and wins a line
- **WHEN** `POST /api/events` records the `line_won` event
- **THEN** the inserted `progression_scores` record MUST reference the `Contoso` organization instead of storing a null organization

#### Scenario: Public email scores under selected organization
- **GIVEN** a player with email `alex@gmail.com` selected organization `Contoso` during onboarding
- **WHEN** `POST /api/events` records a score-bearing event
- **THEN** the inserted `progression_scores` record MUST reference the stored `Contoso` organization

#### Scenario: Existing player without organization context remains safe
- **GIVEN** an existing player record has no stored organization and no resolvable email domain
- **WHEN** `POST /api/events` records a score-bearing event
- **THEN** the endpoint MUST still return `{ ok: true }` and MAY store the progression score with a null organization

### Requirement: Legacy keyword submission uses shared organization resolution
The system SHALL use the shared organization resolver for `POST /api/submissions` so legacy keyword submissions and progression scoring attribute organizations consistently.

#### Scenario: Legacy submission returns resolved organization message
- **GIVEN** `org_domains` maps `contoso.com` to `Contoso`
- **WHEN** `POST /api/submissions` receives email `alex@contoso.com` and a different manually typed organization
- **THEN** the submission MUST be attributed to `Contoso` and the response message MUST reference the resolved organization