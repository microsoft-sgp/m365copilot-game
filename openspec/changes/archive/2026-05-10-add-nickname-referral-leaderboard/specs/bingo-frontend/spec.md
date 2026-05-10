## MODIFIED Requirements

### Requirement: Organization leaderboard displays score and contributors clearly

The system SHALL display organization leaderboard rows with distinct visible metrics for rank, score, contributor count, and top contributor nicknames. The score metric SHALL be the visible numeric metric associated with leaderboard rank order, contributor count MUST be labeled explicitly rather than shown as an ambiguous `#` column, and contributor nicknames MUST supplement the organization ranking without replacing it.

#### Scenario: Leaderboard renders score and contributor metrics

- **GIVEN** the frontend receives leaderboard rows containing `score`, `contributors`, `topContributors`, `hiddenContributorCount`, and `lastSubmission`
- **WHEN** the organization leaderboard renders on the Activity or submission leaderboard view
- **THEN** each row MUST display rank, organization, score, contributor count, top contributor nicknames, and last submission where the viewport supports the timestamp column

#### Scenario: Score explains rank when contributor count differs

- **GIVEN** one organization has a higher score but fewer contributors than another organization
- **WHEN** the organization leaderboard renders the server-provided ranking
- **THEN** the higher-score organization MUST appear above the lower-score organization and the visible score values MUST make the ordering understandable

#### Scenario: Contributor column is explicitly labeled

- **GIVEN** the organization leaderboard has at least one row
- **WHEN** the table headers render
- **THEN** the contributor metric MUST be labeled as contributors or an unambiguous abbreviation, and MUST NOT be labeled only as `#`

#### Scenario: Top contributor nicknames are capped

- **GIVEN** the server returns five top contributor nicknames and a positive hidden contributor count for an organization
- **WHEN** the organization leaderboard row renders
- **THEN** the row MUST show the five nicknames in the server-provided order and append a compact overflow indicator such as `+3`

## ADDED Requirements

### Requirement: Onboarding uses nickname and optional referral code labels
The system SHALL label the player's public display identity as nickname during onboarding and SHALL provide an optional referral-code input without making referral entry mandatory.

#### Scenario: Nickname is requested during onboarding
- **GIVEN** a player has no stored identity
- **WHEN** the onboarding identity screen renders
- **THEN** the form MUST ask for a nickname rather than a name or display name

#### Scenario: Referral code can be skipped
- **GIVEN** a player is on the onboarding identity screen
- **WHEN** the player submits valid required identity fields with the referral-code input empty
- **THEN** the frontend MUST allow the player to continue

#### Scenario: Referral-code validation error is shown
- **GIVEN** session creation returns HTTP 400 because the entered referral code is invalid
- **WHEN** the setup or bootstrap flow handles the response
- **THEN** the frontend MUST show the backend validation message and allow the player to edit or clear the referral code
