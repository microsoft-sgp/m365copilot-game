# admin-portal

## Purpose

Defines the admin portal frontend views including dashboard, player management, CSV export, campaign settings, organization management, and data clearing operations.

## Requirements

### Requirement: Admin dashboard view

The system SHALL provide an authenticated admin dashboard view displaying campaign statistics, recent sessions, and recent submissions, and SHALL distinguish unauthorized admin-session responses from dashboard data-load failures.

#### Scenario: Admin views dashboard statistics

- **GIVEN** the admin is authenticated with a valid JWT
- **WHEN** the admin navigates to the dashboard view
- **THEN** the system MUST fetch data from `GET /api/portal-api/dashboard` and display summary cards for total players, total sessions, total submissions, average tiles cleared, and top organization

#### Scenario: Admin views recent sessions table

- **GIVEN** the dashboard has loaded
- **WHEN** the sessions section renders
- **THEN** the system MUST display a table of recent sessions showing player name, email, pack ID, tiles cleared, lines won, keywords earned, and last active timestamp

#### Scenario: Admin views recent submissions table

- **GIVEN** the dashboard has loaded
- **WHEN** the submissions section renders
- **THEN** the system MUST display a table of recent submissions showing player name, email, organization, keyword, and submission timestamp

#### Scenario: Dashboard detects missing admin session cookie

- **GIVEN** the admin has reached the dashboard after OTP verification or route restoration
- **WHEN** `GET /api/portal-api/dashboard` returns HTTP 401
- **THEN** the system MUST clear the frontend admin-authenticated marker, MUST NOT display the generic "Failed to load dashboard" message, and MUST display a message that the admin session could not be confirmed and the admin must sign in again

### Requirement: CSV export from admin portal

The system SHALL provide a button in the admin dashboard to download submission data as a CSV file.

#### Scenario: Admin exports CSV

- **GIVEN** the admin is on the dashboard view
- **WHEN** the admin clicks the "Export CSV" button
- **THEN** the system MUST call `GET /api/portal-api/export` with the admin JWT and trigger a file download of the CSV

### Requirement: Admin player lookup

The system SHALL provide a player search and detail view in the admin portal for looking up players by email or name.

#### Scenario: Admin searches for a player by email

- **GIVEN** the admin is on the player management view
- **WHEN** the admin enters a search query
- **THEN** the system MUST call `GET /api/portal-api/players?q=<query>` and display matching players with their name, email, session count, and submission count

#### Scenario: Admin views player detail

- **GIVEN** the admin has found a player in search results
- **WHEN** the admin clicks on a player row
- **THEN** the system MUST call `GET /api/portal-api/players/:id` and display the player's full detail including all sessions with progress and all submissions with keywords

### Requirement: Admin player search endpoint

The system SHALL expose `GET /api/portal-api/players` to search players by email or name, protected by admin authentication.

#### Scenario: Search players by query

- **GIVEN** the admin provides a query parameter `q`
- **WHEN** `GET /api/portal-api/players?q=alice` is called
- **THEN** the system MUST return players whose email or player_name contains the query string (case-insensitive), limited to 50 results

#### Scenario: Get player detail

- **GIVEN** a valid player ID
- **WHEN** `GET /api/portal-api/players/:id` is called
- **THEN** the system MUST return the player record with all associated game sessions and submissions

### Requirement: Admin keyword revocation

The system SHALL allow admins to revoke (delete) a keyword submission.

#### Scenario: Admin revokes a submission

- **GIVEN** the admin is viewing a player's detail with their submissions listed
- **WHEN** the admin clicks "Revoke" on a submission and confirms
- **THEN** the system MUST call `DELETE /api/portal-api/submissions/:id` and remove the submission from the database, updating the leaderboard accordingly

#### Scenario: Revocation endpoint

- **GIVEN** a valid submission ID and admin authentication
- **WHEN** `DELETE /api/portal-api/submissions/:id` is called
- **THEN** the system MUST delete the submission record and return `{ ok: true }`

### Requirement: Admin data clearing operations

The system SHALL provide server-side data clearing operations in the admin portal, replacing the client-side "Clear Data" functionality.

#### Scenario: Admin clears campaign data

- **GIVEN** the admin is on the danger zone view
- **WHEN** the admin selects a campaign, types a confirmation phrase, and clicks "Clear Campaign Data"
- **THEN** the system MUST call `POST /api/portal-api/campaigns/:id/clear` which deletes all tile_events, game_sessions, and submissions for that campaign (preserving players and organizations)

#### Scenario: Admin resets leaderboard

- **GIVEN** the admin is on the danger zone view
- **WHEN** the admin selects a campaign, types a confirmation phrase, and clicks "Reset Leaderboard"
- **THEN** the system MUST call `POST /api/portal-api/campaigns/:id/reset-leaderboard` which deletes all submissions for that campaign (preserving sessions and events)

#### Scenario: Clear campaign data endpoint

- **GIVEN** admin authentication and a valid campaign ID
- **WHEN** `POST /api/portal-api/campaigns/:id/clear` is called
- **THEN** the system MUST delete tile_events (via game_sessions FK), game_sessions, and submissions for that campaign, and return `{ ok: true, deleted: { sessions, events, submissions } }`

#### Scenario: Reset leaderboard endpoint

- **GIVEN** admin authentication and a valid campaign ID
- **WHEN** `POST /api/portal-api/campaigns/:id/reset-leaderboard` is called
- **THEN** the system MUST delete all submissions for that campaign and return `{ ok: true, deleted: { submissions } }`

### Requirement: Admin portal layout and navigation

The system SHALL provide a consistent admin layout with sidebar navigation and header showing the authenticated admin email and logout button, and SHALL NOT treat browser-side session storage as sufficient proof of a valid admin session.

#### Scenario: Admin portal navigation

- **GIVEN** the admin is authenticated
- **WHEN** the admin portal renders
- **THEN** the system MUST display a sidebar or tab navigation with links to: Dashboard, Organizations, Campaign Settings, Players, and Danger Zone

#### Scenario: Admin portal accessible via hash route

- **GIVEN** a user navigates to `#/admin` in the URL
- **WHEN** no valid admin session can be confirmed through the stored marker or refresh flow
- **THEN** the system MUST redirect to the admin login view

#### Scenario: Stored admin marker is invalidated by unauthorized admin API response

- **GIVEN** `sessionStorage.admin_authenticated` is `true` but the browser has no valid admin session cookie
- **WHEN** the first authenticated admin API call returns HTTP 401
- **THEN** the system MUST remove `sessionStorage.admin_authenticated` and `sessionStorage.admin_email`, MUST leave the authenticated admin portal state, and MUST require the admin to sign in again before rendering protected admin data

### Requirement: Admin management portal view

The system SHALL provide an admin management view where authenticated admins can list, add, and disable portal-managed admin emails.

#### Scenario: Admin navigation includes admin management

- **GIVEN** the admin portal renders for an authenticated admin
- **WHEN** the navigation is displayed
- **THEN** the system MUST include an Admins or Admin Access view alongside Dashboard, Organizations, Campaign Settings, Players, and Danger Zone

#### Scenario: Admin adds email with OTP step-up

- **GIVEN** the admin is on the admin management view
- **WHEN** the admin chooses to add an email
- **THEN** the UI MUST require the acting admin to re-enter an OTP before submitting the add request

#### Scenario: Admin removes email with OTP step-up

- **GIVEN** the admin is on the admin management view
- **WHEN** the admin chooses to remove or disable an admin email
- **THEN** the UI MUST require the acting admin to re-enter an OTP before submitting the remove or disable request

#### Scenario: Step-up OTP fails

- **GIVEN** the acting admin enters an invalid, expired, or already-used OTP during an admin-management action
- **WHEN** the verification response fails
- **THEN** the UI MUST keep the admin email mutation unsubmitted and display the verification failure message
