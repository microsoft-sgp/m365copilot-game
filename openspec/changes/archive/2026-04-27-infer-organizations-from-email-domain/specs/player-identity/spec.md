## MODIFIED Requirements

### Requirement: Email gate on first load
The system SHALL present an onboarding identity screen before the game setup panel when no player identity is stored locally. The onboarding screen SHALL require email and display name, and SHALL require an organization name when the email domain is a configured public/free-mail provider that cannot identify an organization by domain.

#### Scenario: New player enters private organization email for the first time
- **GIVEN** no player identity exists in localStorage
- **WHEN** the player enters a valid non-public email and display name
- **THEN** the system MUST allow the player to continue without manually entering an organization, blocking access to the game until email and display name are provided

#### Scenario: New player enters public email for the first time
- **GIVEN** no player identity exists in localStorage
- **WHEN** the player enters a public/free-mail address such as `alex@gmail.com`
- **THEN** the system MUST require a non-empty organization name before allowing the player to continue

#### Scenario: Returning player with stored identity skips gate
- **GIVEN** a valid player email and display name exist in localStorage, and any required organization context for public/free-mail identity is stored locally
- **WHEN** the player loads the application
- **THEN** the system MUST skip the identity gate and proceed directly to the game (setup or active board)

#### Scenario: Identity fields are validated before proceeding
- **GIVEN** the player is on the onboarding identity screen
- **WHEN** the player submits an empty display name, empty email, an email without an `@` character, or a required organization name that is empty
- **THEN** the system MUST display a validation error and MUST NOT proceed

### Requirement: Email stored as identity anchor
The system SHALL persist the player's email, onboarding display name, and any required manually entered organization in localStorage and include them in subsequent session-related API calls to maintain identity and organization consistency.

#### Scenario: Identity persisted after private email entry
- **GIVEN** the player enters a valid non-public email and non-empty display name on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the identity to localStorage under dedicated keys and include it in reactive game state

#### Scenario: Identity persisted after public email entry
- **GIVEN** the player enters a valid public/free-mail email, non-empty display name, and non-empty organization name on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the email, display name, and organization name to localStorage under dedicated keys and include them in reactive game state

#### Scenario: Session creation includes onboarding identity
- **GIVEN** a player with stored onboarding identity starts a new board
- **WHEN** `POST /api/sessions` is called
- **THEN** the request body MUST include the player's email, onboarding display name, and any stored organization name alongside sessionId and packId

## ADDED Requirements

### Requirement: Organization prompt for public email users
The system SHALL conditionally show an organization input during onboarding when the entered email domain is a configured public/free-mail provider.

#### Scenario: Public email reveals organization input
- **GIVEN** the player is entering onboarding identity
- **WHEN** the email field contains `alex@outlook.com`
- **THEN** the system MUST show an organization input and MUST require it before continuing

#### Scenario: Private email hides organization input
- **GIVEN** the player is entering onboarding identity
- **WHEN** the email field contains `alex@contoso.com`
- **THEN** the system MUST not require manual organization entry because the backend can infer the organization from the email domain