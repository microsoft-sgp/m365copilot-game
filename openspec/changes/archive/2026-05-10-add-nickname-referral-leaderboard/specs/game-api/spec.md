## MODIFIED Requirements

### Requirement: Session creation endpoint

The system SHALL expose `POST /api/sessions` to create or resume a player record and associated game session when a player starts a board, accepting email as the primary identity, accepting the onboarding nickname through the existing `playerName` compatibility field, accepting an optional referral code, enforcing server-authoritative pack assignment for the active campaign, issuing a player session token bound to the player's row, AND identifying recoverable player ownership conflicts with a stable response code.

#### Scenario: New player starts a board

- **GIVEN** a player with a new email starts a board
- **WHEN** the frontend sends `POST /api/sessions` with identity payload
- **THEN** the system MUST create a player record keyed by email with the onboarding nickname stored as canonical `player_name`, validate and store referral attribution when a non-empty valid referral code is supplied, create or resolve an active pack assignment, create a game session for that assigned pack, set the `player_token` cookie on the response, create an active device-token record, and return `{ ok: true, gameSessionId: <id>, packId: <assignedPackId>, playerToken: <token> }`

#### Scenario: Existing player resumes incomplete assignment

- **GIVEN** a player whose email already exists and whose active assignment is incomplete, and whose request carries a matching player token
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST reuse the existing player record, preserve canonical onboarding nickname, return the same assigned pack id, and MUST NOT rotate the token

#### Scenario: Existing player after completed cycle

- **GIVEN** a player whose active assignment is complete at 7 of 7 weeks, with a matching player token
- **WHEN** the frontend sends `POST /api/sessions` for the same campaign
- **THEN** the system MUST complete the previous assignment lifecycle and return a newly assigned active pack for the next cycle

#### Scenario: Existing player without proof of ownership

- **GIVEN** a player whose email already exists with a non-null `owner_token`, and the request has no token or a non-matching token
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return HTTP 409 with `{ ok: false, code: "PLAYER_RECOVERY_REQUIRED", message: "Identity in use" }` and MUST NOT return player profile, assignment, session, or board-state data

#### Scenario: Legacy player without stored token

- **GIVEN** a `players` row for the submitted email exists with `owner_token IS NULL`
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST atomically populate `owner_token` with the hash of a newly generated token, create an active device-token record, and return that token in the response

#### Scenario: Missing required fields

- **GIVEN** a request missing required identity fields
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return `{ ok: false, message: "..." }` with HTTP 400

#### Scenario: Invalid referral code

- **GIVEN** a request includes a non-empty referral code that is unknown or inactive for the active campaign
- **WHEN** the frontend sends `POST /api/sessions`
- **THEN** the system MUST return HTTP 400 with a clear referral-code validation message and MUST NOT create referral attribution

### Requirement: Leaderboard retrieval endpoint

The system SHALL expose `GET /api/leaderboard` to return aggregated organization rankings from progression scoring records derived from verified gameplay, including top contributor nickname metadata for each organization.

#### Scenario: Leaderboard with progression scoring records

- **GIVEN** one or more progression scoring records exist for the current campaign
- **WHEN** the frontend sends `GET /api/leaderboard?campaign=APR26`
- **THEN** the system MUST return `{ leaderboard: [{ rank, org, score, contributors, topContributors, hiddenContributorCount, lastSubmission }] }` sorted by organization score descending, where score and contributor metrics are computed from progression-derived scoring records

#### Scenario: Leaderboard includes top five contributor nicknames

- **GIVEN** more than five players have contributed progression scores for one organization in the requested campaign
- **WHEN** the frontend sends `GET /api/leaderboard?campaign=APR26`
- **THEN** that organization's leaderboard row MUST include exactly the top five contributor nicknames ordered by contributor score descending, most recent contribution descending, and nickname ascending for remaining ties

#### Scenario: Leaderboard contributor overflow count

- **GIVEN** an organization has more contributors than returned top contributor nicknames
- **WHEN** the leaderboard response is produced
- **THEN** `hiddenContributorCount` MUST equal the total contributor count minus the number of returned top contributor nicknames

#### Scenario: Leaderboard with no progression scoring records

- **GIVEN** no progression scoring records exist for the requested campaign
- **WHEN** the frontend sends `GET /api/leaderboard?campaign=APR26`
- **THEN** the system MUST return `{ leaderboard: [] }`
