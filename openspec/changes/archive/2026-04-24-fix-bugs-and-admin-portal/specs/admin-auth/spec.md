## ADDED Requirements

### Requirement: Admin OTP request endpoint
The system SHALL expose `POST /api/admin/request-otp` to generate and send a 6-digit OTP to an admin email address, with rate limiting and allow-list validation.

#### Scenario: Valid admin email requests OTP
- **GIVEN** the email is in the `ADMIN_EMAILS` environment variable allow-list
- **WHEN** `POST /api/admin/request-otp` is called with `{ email }`
- **THEN** the system MUST generate a cryptographically random 6-digit code, store its SHA-256 hash in the `admin_otps` table with a 10-minute expiry, send the code to the email address, and return `{ ok: true, message: "OTP sent" }`

#### Scenario: Non-admin email requests OTP
- **GIVEN** the email is NOT in the `ADMIN_EMAILS` allow-list
- **WHEN** `POST /api/admin/request-otp` is called with that email
- **THEN** the system MUST return `{ ok: true, message: "OTP sent" }` (same response to prevent email enumeration) but NOT actually send an email or store an OTP

#### Scenario: Rate limiting on OTP requests
- **GIVEN** an OTP was requested for an email within the last 60 seconds
- **WHEN** another OTP request is made for the same email
- **THEN** the system MUST return HTTP 429 with `{ ok: false, message: "Please wait before requesting another code" }`

#### Scenario: ADMIN_EMAILS not configured
- **GIVEN** the `ADMIN_EMAILS` environment variable is not set or empty
- **WHEN** any OTP request is made
- **THEN** the system MUST return HTTP 500 with `{ ok: false, message: "Admin access not configured" }`

### Requirement: Admin OTP verification endpoint
The system SHALL expose `POST /api/admin/verify-otp` to validate a 6-digit OTP and return a signed JWT token on success.

#### Scenario: Valid OTP verification
- **GIVEN** a valid, unexpired, unused OTP exists for the email
- **WHEN** `POST /api/admin/verify-otp` is called with `{ email, code }`
- **THEN** the system MUST mark the OTP as used, generate a JWT signed with `JWT_SECRET` containing `{ email, role: "admin", exp: <4 hours from now> }`, and return `{ ok: true, token: "<jwt>" }`

#### Scenario: Expired OTP
- **GIVEN** the OTP for the email has expired (older than 10 minutes)
- **WHEN** verification is attempted
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Code expired. Please request a new one." }`

#### Scenario: Invalid OTP code
- **GIVEN** the code does not match any valid OTP for the email
- **WHEN** verification is attempted
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Invalid code" }`

#### Scenario: Already-used OTP
- **GIVEN** the OTP has already been used (marked as used)
- **WHEN** verification is attempted with the same code
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Code already used. Please request a new one." }`

### Requirement: JWT-based admin authentication
The system SHALL accept JWT tokens in the `Authorization: Bearer <token>` header as an alternative to the existing `x-admin-key` header for authenticating admin API requests.

#### Scenario: Valid JWT authenticates admin request
- **GIVEN** the request includes `Authorization: Bearer <valid-jwt>` with a non-expired token signed by `JWT_SECRET`
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST authenticate the request and proceed

#### Scenario: Expired JWT is rejected
- **GIVEN** the request includes a JWT that has expired
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Token expired" }`

#### Scenario: Backward compatibility with x-admin-key
- **GIVEN** the request includes a valid `x-admin-key` header but no JWT
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST authenticate via the existing static key comparison (backward compatible)

#### Scenario: Neither JWT nor admin key provided
- **GIVEN** the request has neither a valid JWT nor a valid `x-admin-key` header
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: Admin login frontend flow
The system SHALL provide an admin login screen accessible from the main landing page with email input and OTP verification steps.

#### Scenario: Admin login button on landing page
- **GIVEN** the player is on the email gate screen
- **WHEN** the screen renders
- **THEN** a visible "Admin Login" button MUST be present that navigates to the admin login view

#### Scenario: Admin enters email and requests OTP
- **GIVEN** the admin is on the admin login view
- **WHEN** the admin enters their email and clicks "Send Code"
- **THEN** the system MUST call `POST /api/admin/request-otp` and display the OTP input field

#### Scenario: Admin verifies OTP and receives token
- **GIVEN** the admin has received an OTP and enters the 6-digit code
- **WHEN** the admin submits the code
- **THEN** the system MUST call `POST /api/admin/verify-otp`, store the returned JWT in `sessionStorage`, and navigate to the admin dashboard view

#### Scenario: Admin logs out
- **GIVEN** the admin is authenticated and viewing the admin portal
- **WHEN** the admin clicks "Logout"
- **THEN** the system MUST remove the JWT from `sessionStorage` and navigate back to the main landing page
