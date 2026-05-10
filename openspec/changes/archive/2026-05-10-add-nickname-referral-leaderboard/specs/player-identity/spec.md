## MODIFIED Requirements

### Requirement: Email gate on first load

The system SHALL present an onboarding identity screen before the game setup panel when no player identity is stored locally. The onboarding screen SHALL require email and nickname, SHALL allow an optional Student Ambassador referral code, and SHALL require an organization name when the email domain is a configured public/free-mail provider that cannot identify an organization by domain.

#### Scenario: New player enters private organization email for the first time

- **GIVEN** no player identity exists in localStorage
- **WHEN** the player enters a valid non-public email and nickname
- **THEN** the system MUST allow the player to continue without manually entering an organization, blocking access to the game until email and nickname are provided

#### Scenario: New player enters public email for the first time

- **GIVEN** no player identity exists in localStorage
- **WHEN** the player enters a public/free-mail address such as `alex@gmail.com`
- **THEN** the system MUST require a non-empty organization name before allowing the player to continue

#### Scenario: Returning player with stored identity skips gate

- **GIVEN** a valid player email and nickname exist in localStorage, and any required organization context for public/free-mail identity is stored locally
- **WHEN** the player loads the application
- **THEN** the system MUST skip the identity gate and proceed directly to the game (setup or active board)

#### Scenario: Identity fields are validated before proceeding

- **GIVEN** the player is on the onboarding identity screen
- **WHEN** the player submits an empty nickname, empty email, an email without an `@` character, or a required organization name that is empty
- **THEN** the system MUST display a validation error and MUST NOT proceed

#### Scenario: Optional referral code is captured during onboarding

- **GIVEN** the player is on the onboarding identity screen
- **WHEN** the player enters a referral code along with valid required identity fields
- **THEN** the system MUST retain the referral code for session bootstrap without making referral code entry mandatory

### Requirement: Email stored as identity anchor

The system SHALL persist the player's email, onboarding nickname, any required manually entered organization, and any entered referral code in localStorage and include them in subsequent session-related API calls to maintain identity, organization, and referral-attribution consistency.

#### Scenario: Identity persisted after private email entry

- **GIVEN** the player enters a valid email and non-empty nickname on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the identity to localStorage under dedicated keys and include it in reactive game state

#### Scenario: Identity persisted after public email entry

- **GIVEN** the player enters a valid public/free-mail email, non-empty nickname, and non-empty organization name on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the email, nickname, and organization name to localStorage under dedicated keys and include them in reactive game state

#### Scenario: Optional referral code persisted after onboarding

- **GIVEN** the player enters a non-empty referral code on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the referral code under a dedicated localStorage key so it can be included in the next session creation request

#### Scenario: Session creation includes onboarding identity

- **GIVEN** a player with stored onboarding identity starts a new board
- **WHEN** `POST /api/sessions` is called
- **THEN** the request body MUST include the player's email, onboarding nickname using the existing `playerName` compatibility field, any stored organization name, and any stored referral code alongside sessionId and packId

### Requirement: Display name is fixed after onboarding

The system SHALL treat player nickname as immutable for normal player flows after onboarding is completed.

#### Scenario: Player attempts to change nickname during gameplay

- **GIVEN** a player has already completed onboarding and entered gameplay
- **WHEN** the player navigates across setup, game, keys, or activity surfaces
- **THEN** the system MUST NOT present any nickname edit controls and MUST continue using the onboarding nickname
