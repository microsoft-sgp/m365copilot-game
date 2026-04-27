## MODIFIED Requirements

### Requirement: Admin OTP request endpoint
The system SHALL expose `POST /api/portal-api/request-otp` to generate and send a 6-digit OTP to an admin email address through Azure Communication Services Email, with rate limiting and allow-list validation.

#### Scenario: Valid admin email requests OTP
- **GIVEN** the email is in the effective admin allow-list from `ADMIN_EMAILS` or active database-backed admin users
- **WHEN** `POST /api/portal-api/request-otp` is called with `{ email }`
- **THEN** the system MUST generate a cryptographically random 6-digit code, store its SHA-256 hash in the `admin_otps` table with a 10-minute expiry, send the code to the email address through Azure Communication Services Email, and return `{ ok: true, message: "OTP sent" }`

#### Scenario: Non-admin email requests OTP
- **GIVEN** the email is NOT in the effective admin allow-list
- **WHEN** `POST /api/portal-api/request-otp` is called with that email
- **THEN** the system MUST return `{ ok: true, message: "OTP sent" }` (same response to prevent email enumeration) but NOT actually send an email or store an OTP

#### Scenario: Rate limiting on OTP requests
- **GIVEN** an OTP was requested for an email within the last 60 seconds
- **WHEN** another OTP request is made for the same email
- **THEN** the system MUST return HTTP 429 with `{ ok: false, message: "Please wait before requesting another code" }`

#### Scenario: Admin allow-list not configured
- **GIVEN** neither `ADMIN_EMAILS` nor active database-backed admin users are configured
- **WHEN** any OTP request is made
- **THEN** the system MUST return HTTP 500 with `{ ok: false, message: "Admin access not configured" }`

#### Scenario: ACS Email provider cannot send OTP
- **GIVEN** the email is in the effective admin allow-list and an OTP row has been inserted
- **WHEN** Azure Communication Services Email fails to send the OTP
- **THEN** the system MUST invalidate the stored OTP so it cannot be verified and return HTTP 502 or 503 with `{ ok: false, message: "Could not send verification code. Please try again later." }`

## ADDED Requirements

### Requirement: Step-up OTP verification for admin management
The system SHALL require a fresh OTP verification before allowing an authenticated admin to add, disable, remove, or otherwise change admin email allow-list entries.

#### Scenario: Admin completes step-up OTP before adding admin
- **GIVEN** an authenticated admin wants to add another admin email
- **WHEN** the admin completes a fresh OTP challenge for their own admin email
- **THEN** the system MUST issue a short-lived proof that authorizes admin-management mutations only

#### Scenario: Admin attempts admin-management mutation without step-up OTP
- **GIVEN** an authenticated admin has a valid JWT but no fresh admin-management OTP proof
- **WHEN** the admin calls an endpoint that adds, disables, removes, or changes an admin email
- **THEN** the system MUST reject the request with HTTP 403 and a message requiring OTP re-verification

#### Scenario: Step-up OTP proof expires
- **GIVEN** an admin completed step-up OTP verification more than the allowed proof lifetime ago
- **WHEN** the admin attempts to add, disable, remove, or change an admin email
- **THEN** the system MUST reject the request and require a new OTP challenge