## ADDED Requirements

### Requirement: Admin missing-cookie session regression coverage

The system SHALL provide automated frontend coverage for the case where OTP verification succeeds but authenticated admin API calls return HTTP 401 because the cookie-backed admin session cannot be confirmed.

#### Scenario: OTP success followed by dashboard unauthorized response

- **GIVEN** the mocked admin browser flow returns success for OTP request and OTP verification, but returns HTTP 401 for `GET /api/portal-api/dashboard`
- **WHEN** an admin enters the OTP and the frontend attempts to load the admin dashboard
- **THEN** the suite MUST verify that the frontend clears `sessionStorage.admin_authenticated`, does not show the generic "Failed to load dashboard" message, shows a session-confirmation failure message, and returns the admin to the login flow

#### Scenario: Stored admin marker without usable cookie

- **GIVEN** the browser has `sessionStorage.admin_authenticated` set to `true` and authenticated admin API calls are mocked to return HTTP 401
- **WHEN** the user opens `#/admin`
- **THEN** the suite MUST verify that protected admin data is not rendered, stale admin session storage is cleared, and the admin login flow is shown