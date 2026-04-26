## MODIFIED Requirements

### Requirement: Email gate on first load
The system SHALL present an onboarding identity screen before the game setup panel when no player identity is stored locally. The onboarding screen SHALL require both email and display name.

#### Scenario: New player enters identity for the first time
- **GIVEN** no player identity exists in localStorage
- **WHEN** the player loads the application
- **THEN** the system MUST display onboarding inputs for email and display name with a Continue action, blocking access to the game until both are provided

#### Scenario: Returning player with stored identity skips gate
- **GIVEN** a valid player email and display name exist in localStorage
- **WHEN** the player loads the application
- **THEN** the system MUST skip the identity gate and proceed directly to the game (setup or active board)

#### Scenario: Identity fields are validated before proceeding
- **GIVEN** the player is on the onboarding identity screen
- **WHEN** the player submits an empty display name, empty email, or an email without an `@` character
- **THEN** the system MUST display a validation error and MUST NOT proceed

### Requirement: Email stored as identity anchor
The system SHALL persist the player's email and onboarding display name in localStorage and include them in subsequent session-related API calls to maintain identity consistency.

#### Scenario: Identity persisted after entry
- **GIVEN** the player enters a valid email and non-empty display name on onboarding
- **WHEN** the player proceeds
- **THEN** the system MUST save the identity to localStorage under dedicated keys and include it in reactive game state

#### Scenario: Session creation includes onboarding identity
- **GIVEN** a player with stored onboarding identity starts a new board
- **WHEN** `POST /api/sessions` is called
- **THEN** the request body MUST include the player's email and onboarding display name alongside sessionId and packId

## ADDED Requirements

### Requirement: Display name is fixed after onboarding
The system SHALL treat player display name as immutable for normal player flows after onboarding is completed.

#### Scenario: Player attempts to change display name during gameplay
- **GIVEN** a player has already completed onboarding and entered gameplay
- **WHEN** the player navigates across setup, game, keys, or activity surfaces
- **THEN** the system MUST NOT present any display name edit controls and MUST continue using the onboarding display name
