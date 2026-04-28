# admin-auth

## Purpose

Defines admin authentication via OTP-based login flow, httpOnly JWT session cookies, and administrative API authentication.

## Requirements

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

### Requirement: Step-up OTP verification for admin management

The system SHALL require a fresh OTP verification before allowing an authenticated admin to add, disable, remove, or otherwise change admin email allow-list entries, and the resulting proof MUST NOT be exposed to browser JavaScript as token material.

#### Scenario: Admin completes step-up OTP before adding admin

- **GIVEN** an authenticated admin wants to add another admin email
- **WHEN** the admin completes a fresh OTP challenge for their own admin email
- **THEN** the system MUST issue a short-lived admin-management proof through an httpOnly cookie or equivalent server-validated mechanism that authorizes admin-management mutations only

#### Scenario: Admin attempts admin-management mutation without step-up OTP

- **GIVEN** an authenticated admin has a valid admin session but no fresh admin-management OTP proof
- **WHEN** the admin calls an endpoint that adds, disables, removes, or changes an admin email
- **THEN** the system MUST reject the request with HTTP 403 and a message requiring OTP re-verification

#### Scenario: Step-up OTP proof expires

- **GIVEN** an admin completed step-up OTP verification more than the allowed proof lifetime ago
- **WHEN** the admin attempts to add, disable, remove, or change an admin email
- **THEN** the system MUST reject the request and require a new OTP challenge

### Requirement: Admin OTP verification endpoint

The system SHALL expose `POST /api/portal-api/verify-otp` to validate a 6-digit OTP and establish an admin session using httpOnly JWT access and refresh cookies on success.

#### Scenario: Valid OTP verification

- **GIVEN** a valid, unexpired, unused OTP exists for the email
- **WHEN** `POST /api/portal-api/verify-otp` is called with `{ email, code }`
- **THEN** the system MUST mark the OTP as used, generate JWT access and refresh tokens signed with `JWT_SECRET`, set them as httpOnly cookies with secure environment-appropriate attributes, and return `{ ok: true }` without returning token strings in the JSON body

#### Scenario: Expired OTP

- **GIVEN** the OTP for the email has expired (older than 10 minutes)
- **WHEN** verification is attempted
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Code expired. Please request a new one." }` and MUST NOT issue auth cookies

#### Scenario: Invalid OTP code

- **GIVEN** the code does not match any valid OTP for the email
- **WHEN** verification is attempted
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Invalid code" }` and MUST NOT issue auth cookies

#### Scenario: Already-used OTP

- **GIVEN** the OTP has already been used (marked as used)
- **WHEN** verification is attempted with the same code
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Code already used. Please request a new one." }` and MUST NOT issue auth cookies

### Requirement: Admin session refresh and logout endpoints

The system SHALL expose admin session refresh and logout endpoints that operate on httpOnly JWT cookies without exposing refresh token material to browser JavaScript.

#### Scenario: Refresh endpoint rotates session cookies

- **GIVEN** the request includes a valid admin refresh cookie
- **WHEN** `POST /api/portal-api/refresh` is called
- **THEN** the system MUST verify the refresh JWT, issue a new short-lived access cookie, rotate or renew the refresh cookie according to the configured session policy, and return `{ ok: true }` without returning token strings in the JSON body

#### Scenario: Refresh endpoint rejects invalid refresh cookie

- **GIVEN** the request has no valid admin refresh cookie
- **WHEN** `POST /api/portal-api/refresh` is called
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }` and MUST NOT issue new auth cookies

#### Scenario: Logout endpoint clears auth cookies

- **GIVEN** an admin has access, refresh, or step-up cookies set
- **WHEN** `POST /api/portal-api/logout` is called
- **THEN** the system MUST clear the admin auth cookies using matching cookie names, paths, domains, and security attributes, and return `{ ok: true }`

### Requirement: JWT-based admin authentication

The system SHALL authenticate admin API requests using a valid JWT access token from an httpOnly cookie, with `x-admin-key` retained as a break-glass administrative path.

#### Scenario: Valid JWT cookie authenticates admin request

- **GIVEN** the request includes a non-expired admin access cookie containing a JWT signed by `JWT_SECRET`
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST authenticate the request and proceed

#### Scenario: Expired JWT cookie is rejected

- **GIVEN** the request includes an admin access cookie containing a JWT that has expired
- **WHEN** any admin endpoint is accessed without a successful refresh
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Token expired" }`

#### Scenario: Backward compatibility with x-admin-key

- **GIVEN** the request includes a valid `x-admin-key` header but no valid admin JWT cookie
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST authenticate via the existing static key comparison as a break-glass path

#### Scenario: Neither JWT cookie nor admin key provided

- **GIVEN** the request has neither a valid admin JWT cookie nor a valid `x-admin-key` header
- **WHEN** any admin endpoint is accessed
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }`

### Requirement: Admin login frontend flow

The system SHALL provide an admin login screen accessible from the main landing page with email input and OTP verification steps, and SHALL rely on credentialed cookie-based requests rather than browser-accessible JWT storage.

#### Scenario: Admin login button on landing page

- **GIVEN** the player is on the email gate screen
- **WHEN** the screen renders
- **THEN** a visible "Admin Login" button MUST be present that navigates to the admin login view

#### Scenario: Admin enters email and requests OTP

- **GIVEN** the admin is on the admin login view
- **WHEN** the admin enters their email and clicks "Send Code"
- **THEN** the system MUST call `POST /api/portal-api/request-otp` and display the OTP input field

#### Scenario: Admin verifies OTP and receives cookie session

- **GIVEN** the admin has received an OTP and enters the 6-digit code
- **WHEN** the admin submits the code
- **THEN** the system MUST call `POST /api/portal-api/verify-otp`, allow the browser to store httpOnly auth cookies from the response, avoid storing JWT token strings in `sessionStorage` or `localStorage`, and navigate to the admin dashboard view

#### Scenario: Admin logs out

- **GIVEN** the admin is authenticated and viewing the admin portal
- **WHEN** the admin clicks "Logout"
- **THEN** the system MUST call the logout endpoint, clear client-side non-sensitive admin state, and navigate back to the main landing page
