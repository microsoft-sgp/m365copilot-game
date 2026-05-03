## MODIFIED Requirements

### Requirement: Recoverable player identity conflict UX

The system SHALL guide players through email-based recovery when the backend reports that their player email is already claimed but the current browser lacks matching ownership proof. The recovery-code request UI SHALL keep players informed during slow delivery confirmation without showing the code-entry step before the request succeeds.

#### Scenario: Setup detects recoverable identity conflict

- **GIVEN** a player has entered onboarding identity and attempts to launch or sync a board from a browser without the matching player token
- **WHEN** `POST /api/sessions` returns HTTP 409 with `code: "PLAYER_RECOVERY_REQUIRED"`
- **THEN** the frontend MUST show a player recovery state for that email and MUST NOT show the error as an unrecoverable generic launch failure

#### Scenario: Recovery request can be started from setup

- **GIVEN** the frontend is showing the player recovery state for an email
- **WHEN** the player requests a recovery code
- **THEN** the frontend MUST call `POST /api/player/recovery/request` with the player's email, show an initial sending status while the request is pending, and show the code-entry step only when the request succeeds

#### Scenario: Slow recovery request shows delivery confirmation status

- **GIVEN** the player has requested a recovery code and the request has not completed within the configured slow-send threshold
- **WHEN** the request remains pending
- **THEN** the frontend MUST keep duplicate recovery-code requests blocked, MUST show a pending status such as "Confirming delivery...", and MUST NOT show the recovery code-entry step yet

#### Scenario: Recovery request failure clears pending status

- **GIVEN** the player has requested a recovery code
- **WHEN** `POST /api/player/recovery/request` returns a rate-limit, service-failure, or network-failure response
- **THEN** the frontend MUST clear the pending request status, MUST show the appropriate error message, MUST allow retry when the response is retryable, and MUST NOT show the recovery code-entry step

#### Scenario: Successful recovery resumes board bootstrap

- **GIVEN** the player has received a recovery code for their email
- **WHEN** the player submits the correct code and `POST /api/player/recovery/verify` returns a `playerToken`
- **THEN** the frontend MUST store the `playerToken` using the existing player-token storage mechanism, MUST retry session/bootstrap for the same identity, and MUST hydrate the active board from server state when available

#### Scenario: Failed recovery keeps player out of local board

- **GIVEN** the frontend is showing the player recovery state
- **WHEN** recovery verification fails or is cancelled
- **THEN** the frontend MUST keep the player outside the active board for that claimed email until recovery succeeds or the player chooses a different identity
