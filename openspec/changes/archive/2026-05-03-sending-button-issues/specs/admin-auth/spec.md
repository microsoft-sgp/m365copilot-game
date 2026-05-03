## MODIFIED Requirements

### Requirement: Admin login frontend flow

The system SHALL provide an admin login screen accessible from the main landing page with email input and OTP verification steps, and SHALL rely on credentialed cookie-based requests rather than browser-accessible JWT storage. The admin OTP request UI SHALL keep users informed during slow delivery confirmation without revealing the OTP input before the request succeeds.

#### Scenario: Admin login button on landing page

- **GIVEN** the player is on the email gate screen
- **WHEN** the screen renders
- **THEN** a visible "Admin Login" button MUST be present that navigates to the admin login view

#### Scenario: Admin enters email and requests OTP

- **GIVEN** the admin is on the admin login view
- **WHEN** the admin enters their email and clicks "Send Code"
- **THEN** the system MUST call `POST /api/portal-api/request-otp`, show an initial sending status while the request is pending, and display the OTP input field only when the request succeeds

#### Scenario: Slow admin OTP request shows delivery confirmation status

- **GIVEN** the admin has clicked "Send Code" and the OTP request has not completed within the configured slow-send threshold
- **WHEN** the request remains pending
- **THEN** the frontend MUST keep duplicate send submission blocked, MUST show a pending status such as "Confirming delivery...", and MUST NOT display the OTP input field yet

#### Scenario: Admin OTP request failure clears pending status

- **GIVEN** the admin has clicked "Send Code"
- **WHEN** `POST /api/portal-api/request-otp` returns a rate-limit, service-failure, or network-failure response
- **THEN** the frontend MUST clear the pending send status, MUST show the appropriate error message, MUST allow the admin to retry when the response is retryable, and MUST NOT display the OTP input field

#### Scenario: Admin verifies OTP and receives cookie session

- **GIVEN** the admin has received an OTP and enters the 6-digit code
- **WHEN** the admin submits the code
- **THEN** the system MUST call `POST /api/portal-api/verify-otp`, allow the browser to store httpOnly auth cookies from the response, avoid storing JWT token strings in `sessionStorage` or `localStorage`, and navigate to the admin dashboard view

#### Scenario: Admin logs out

- **GIVEN** the admin is authenticated and viewing the admin portal
- **WHEN** the admin clicks "Logout"
- **THEN** the system MUST call the logout endpoint, clear client-side non-sensitive admin state, and navigate back to the main landing page
