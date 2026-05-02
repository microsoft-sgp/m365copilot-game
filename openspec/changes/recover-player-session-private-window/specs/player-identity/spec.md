## ADDED Requirements

### Requirement: Recoverable player identity conflict UX

The system SHALL guide players through email-based recovery when the backend reports that their player email is already claimed but the current browser lacks matching ownership proof.

#### Scenario: Setup detects recoverable identity conflict

- **GIVEN** a player has entered onboarding identity and attempts to launch or sync a board from a browser without the matching player token
- **WHEN** `POST /api/sessions` returns HTTP 409 with `code: "PLAYER_RECOVERY_REQUIRED"`
- **THEN** the frontend MUST show a player recovery state for that email and MUST NOT show the error as an unrecoverable generic launch failure

#### Scenario: Recovery request can be started from setup

- **GIVEN** the frontend is showing the player recovery state for an email
- **WHEN** the player requests a recovery code
- **THEN** the frontend MUST call `POST /api/player/recovery/request` with the player's email and MUST show the code-entry step when the request succeeds

#### Scenario: Successful recovery resumes board bootstrap

- **GIVEN** the player has received a recovery code for their email
- **WHEN** the player submits the correct code and `POST /api/player/recovery/verify` returns a `playerToken`
- **THEN** the frontend MUST store the `playerToken` using the existing player-token storage mechanism, MUST retry session/bootstrap for the same identity, and MUST hydrate the active board from server state when available

#### Scenario: Failed recovery keeps player out of local board

- **GIVEN** the frontend is showing the player recovery state
- **WHEN** recovery verification fails or is cancelled
- **THEN** the frontend MUST keep the player outside the active board for that claimed email until recovery succeeds or the player chooses a different identity

### Requirement: Local-only progress blocked during recovery

The system SHALL prevent new local-only gameplay progress from being minted while player identity recovery is required.

#### Scenario: Cached board is not launched after recoverable conflict

- **GIVEN** localStorage contains cached board or pack data for an email
- **WHEN** server bootstrap returns `PLAYER_RECOVERY_REQUIRED` for that email
- **THEN** the frontend MUST NOT launch the cached board, verify additional tiles, mint new keywords, or record local-only progress before recovery succeeds

#### Scenario: Existing active board pauses after ownership failure

- **GIVEN** a player is viewing an active board and a game API call returns ownership failure for the current email
- **WHEN** the frontend cannot re-bootstrap a valid player token automatically
- **THEN** the frontend MUST pause further tile verification and keyword minting and MUST prompt for player recovery

### Requirement: Player recovery remains separate from admin login

The system SHALL present player recovery as a game identity flow, not as an admin login flow.

#### Scenario: Admin button does not start player recovery

- **GIVEN** a player is on the game surface and chooses the admin button
- **WHEN** the admin login view is opened
- **THEN** the frontend MUST use the admin OTP flow and MUST NOT treat admin OTP success or failure as player identity recovery

#### Scenario: Player recovery does not mark admin authenticated

- **GIVEN** a player successfully verifies a player recovery code
- **WHEN** the frontend stores the recovered player token
- **THEN** the frontend MUST NOT set `admin_authenticated`, `admin_email`, or any admin session state in browser storage
