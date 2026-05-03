## MODIFIED Requirements

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