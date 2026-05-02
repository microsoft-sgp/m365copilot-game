# automated-functional-testing

## Purpose

Defines the browser-level automated functional testing strategy for player gameplay, admin portal workflows, hardening contracts, and explicitly gated full-stack smoke coverage.

## Requirements

### Requirement: Fast mocked player functional coverage

The system SHALL provide Playwright browser tests that validate the core player gameplay flow against deterministic mocked API responses without requiring the backend, database, Redis, or external services.

#### Scenario: Player onboarding validation is covered

- **GIVEN** the fast Playwright suite is running against the frontend dev server with mocked API routes
- **WHEN** the player submits missing display name, missing email, invalid email, or a public email without organization
- **THEN** the suite MUST verify that the onboarding screen blocks progression and displays the expected validation feedback

#### Scenario: Player completes a board line in the browser

- **GIVEN** the fast Playwright suite has mocked player-state, session, event, session-update, leaderboard, and organization-domain API responses
- **WHEN** a player completes onboarding, launches the assigned board, verifies three valid tile proofs, and completes a Bingo line
- **THEN** the suite MUST verify that the board renders the assigned pack, the three tiles are marked cleared, the line-win feedback appears, a keyword is minted, score-bearing events are sent, and the activity/leaderboard views reflect the result

#### Scenario: Player state persists across reload

- **GIVEN** a player has cleared tiles and earned at least one keyword in the mocked browser flow
- **WHEN** the page reloads
- **THEN** the suite MUST verify that local browser state restores the active board, cleared tile count, earned keyword, and player identity without returning to the onboarding gate

#### Scenario: Player token forwarding and retry are covered

- **GIVEN** the mocked API returns a `playerToken` from `POST /api/sessions` and can simulate a protected game endpoint returning HTTP 401 once
- **WHEN** the SPA sends subsequent game API calls after session creation or after a stale-token response
- **THEN** the suite MUST verify that `X-Player-Token` is sent on protected game calls, the stale token is cleared on 401, `POST /api/sessions` is called to re-bootstrap, and the original action is retried exactly once with the refreshed token

### Requirement: Fast mocked admin functional coverage

The system SHALL provide Playwright browser tests that validate admin portal workflows against deterministic mocked API responses while preserving cookie-backed session behavior in the browser.

#### Scenario: Admin login uses cookie-backed OTP session

- **GIVEN** the fast Playwright suite has mocked admin OTP request, OTP verification, refresh, logout, and dashboard responses
- **WHEN** an admin requests an OTP, verifies the code, opens the admin portal, and logs out
- **THEN** the suite MUST verify that httpOnly admin cookies are stored, admin JWT token strings are absent from `localStorage` and `sessionStorage`, dashboard data loads with credentials, logout returns to the game entry view, and a later direct admin route requires refresh or login

#### Scenario: Admin dashboard and export are covered

- **GIVEN** the admin is authenticated in the mocked browser flow
- **WHEN** the dashboard view loads and the admin triggers CSV export
- **THEN** the suite MUST verify that summary metrics, recent sessions, recent score events, and the download action are exercised

#### Scenario: Admin management views are covered

- **GIVEN** the admin is authenticated in the mocked browser flow
- **WHEN** the admin uses Organizations, Campaigns, Players, Admin Access, and Danger Zone views
- **THEN** the suite MUST verify create, edit, search, detail, step-up OTP, destructive confirmation, cancel, success, and error-state paths for the relevant views without mutating a real backend

### Requirement: Hardening contract coverage

The system SHALL provide Playwright tests that specifically detect regressions in security-sensitive contracts introduced by admin session and player-state hardening.

#### Scenario: Player state request never exposes email in URL

- **GIVEN** the browser suite captures the request made when onboarding submits an email
- **WHEN** the SPA retrieves cross-device player state
- **THEN** the suite MUST verify that the request method is `POST`, the request URL path is exactly `/api/player/state`, the URL contains no query string or email path segment, and the email appears only in the JSON request body

#### Scenario: Admin refresh rejects forbidden Origin

- **GIVEN** the gated full-stack suite has a valid local admin refresh cookie and the backend is configured with `ALLOWED_ORIGINS`
- **WHEN** `POST /api/portal-api/refresh` is sent with no `Origin` header or with an Origin outside the allowlist
- **THEN** the suite MUST verify that the backend returns HTTP 403 with `{ ok: false, message: "Forbidden origin" }` and does not issue replacement admin auth cookies

#### Scenario: Admin logout rejects forbidden Origin

- **GIVEN** the gated full-stack suite has valid local admin cookies and the backend is configured with `ALLOWED_ORIGINS`
- **WHEN** `POST /api/portal-api/logout` is sent with no `Origin` header or with an Origin outside the allowlist
- **THEN** the suite MUST verify that the backend returns HTTP 403 with `{ ok: false, message: "Forbidden origin" }` and does not clear or modify admin auth cookies

#### Scenario: OTP replay cannot establish duplicate sessions

- **GIVEN** the gated full-stack suite has inserted one valid local OTP row for an allowed admin email using a test-only seed helper
- **WHEN** two concurrent `POST /api/portal-api/verify-otp` requests submit the same email and code
- **THEN** the suite MUST verify that exactly one request succeeds, exactly one request fails with HTTP 401 and the already-used-code message, and the failed response does not contain admin auth cookies

### Requirement: Full-stack smoke coverage is explicit and isolated

The system SHALL provide an opt-in Playwright full-stack smoke suite for local Docker Compose validation that uses unique test data and cannot run accidentally against shared Azure environments.

#### Scenario: Full-stack suite is gated by explicit configuration

- **GIVEN** a developer runs Playwright without the full-stack enablement environment variable
- **WHEN** full-stack smoke tests are discovered
- **THEN** those tests MUST skip with a clear message instead of attempting to create data or call a live backend

#### Scenario: Full-stack player smoke uses unique data

- **GIVEN** the local Docker Compose stack is running and full-stack smoke is explicitly enabled
- **WHEN** the suite completes a player onboarding and gameplay smoke path
- **THEN** the suite MUST use a unique player email/name, avoid shared Azure endpoints, verify session creation against the real backend, and leave no dependency on pre-existing database rows except seeded baseline organizations/campaigns

#### Scenario: Full-stack admin smoke avoids irreversible shared mutations

- **GIVEN** the local Docker Compose stack is running and full-stack smoke is explicitly enabled
- **WHEN** the suite exercises admin-only operations
- **THEN** the suite MUST constrain destructive actions to uniquely-created or local-only records and MUST NOT run against production or shared development Azure resources

### Requirement: Test execution documentation and scripts

The system SHALL document and expose commands for running the fast Playwright suite and the optional full-stack smoke suite.

#### Scenario: Fast suite command is documented

- **GIVEN** a contributor wants to run browser functional tests locally
- **WHEN** they read the repository testing documentation
- **THEN** the documentation MUST identify the fast Playwright command, what it covers, and that it runs with mocked API responses by default

#### Scenario: Full-stack suite command is documented

- **GIVEN** a maintainer wants to validate hardening behavior against the real local stack
- **WHEN** they read the repository testing documentation
- **THEN** the documentation MUST explain how to start Docker Compose, set the required environment variables, run the full-stack Playwright command, and avoid pointing destructive smoke tests at shared Azure environments