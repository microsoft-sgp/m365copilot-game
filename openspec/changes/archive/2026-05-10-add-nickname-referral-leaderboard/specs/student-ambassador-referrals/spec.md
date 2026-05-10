## ADDED Requirements

### Requirement: Student Ambassador referral catalog
The system SHALL maintain a campaign-scoped catalog of Student Ambassador referral codes that can be used to attribute players during onboarding.

#### Scenario: Active referral code resolves to ambassador
- **GIVEN** a Student Ambassador referral code exists for the active campaign and is marked active
- **WHEN** the backend validates that referral code during session creation
- **THEN** the system MUST resolve the code to the corresponding Student Ambassador record

#### Scenario: Unknown referral code is rejected
- **GIVEN** a player enters a referral code that does not exist for the active campaign
- **WHEN** the backend validates that referral code during session creation
- **THEN** the system MUST return HTTP 400 with a clear validation message and MUST NOT create referral attribution for the player

#### Scenario: Inactive referral code is rejected
- **GIVEN** a Student Ambassador referral code exists but is marked inactive
- **WHEN** the backend validates that referral code during session creation
- **THEN** the system MUST return HTTP 400 with a clear validation message and MUST NOT create referral attribution for the player

### Requirement: Player referral attribution
The system SHALL store optional player-to-Student-Ambassador referral attribution when a valid referral code is supplied during initial onboarding or first session bootstrap.

#### Scenario: New player supplies valid referral code
- **GIVEN** a new player completes onboarding with a valid referral code
- **WHEN** `POST /api/sessions` creates the player record
- **THEN** the system MUST store referral attribution linking the player, campaign, referral code, and Student Ambassador

#### Scenario: Player omits referral code
- **GIVEN** a player completes onboarding without entering a referral code
- **WHEN** `POST /api/sessions` creates or resumes the player record
- **THEN** the system MUST allow play to continue and MUST NOT require referral attribution

#### Scenario: Existing attribution is preserved
- **GIVEN** a player already has referral attribution for the campaign
- **WHEN** the player later calls `POST /api/sessions` with a different referral code
- **THEN** the system MUST preserve the original attribution and MUST NOT replace it through normal player flows

### Requirement: Referral attribution does not affect gameplay scoring
The system SHALL keep Student Ambassador referral attribution separate from gameplay scoring, pack assignment, organization attribution, and leaderboard rank calculation.

#### Scenario: Referral code does not change leaderboard score
- **GIVEN** two players complete the same score-bearing gameplay events for the same organization and campaign, and only one player has referral attribution
- **WHEN** the organization leaderboard is calculated
- **THEN** both players' score contributions MUST be counted by the existing progression-scoring rules without any bonus, penalty, or rank change caused by referral attribution
