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

### Requirement: Admin OTP ACS delivery depends on resolved runtime configuration

The system SHALL send admin OTP email through Azure Communication Services only when the ACS connection string and sender settings are resolved runtime values, and SHALL fail visibly when those settings are missing or unresolved in production.

#### Scenario: Admin OTP sends with resolved ACS settings

- **GIVEN** an email is in the effective admin allow-list and `ACS_CONNECTION_STRING` plus `ACS_EMAIL_SENDER` are resolved runtime values
- **WHEN** `POST /api/portal-api/request-otp` is called with that email
- **THEN** the system MUST send the OTP through Azure Communication Services Email, store only the OTP hash, and emit `admin_otp_send_attempt` with `outcome: "sent"` when ACS reports success

#### Scenario: Admin OTP rejects unresolved Key Vault reference

- **GIVEN** an email is in the effective admin allow-list and `ACS_CONNECTION_STRING` or `ACS_EMAIL_SENDER` is visible to the application as an unresolved `@Microsoft.KeyVault(...)` reference
- **WHEN** `POST /api/portal-api/request-otp` is called with that email
- **THEN** the system MUST invalidate any inserted OTP, return HTTP 502 or 503 with the existing generic delivery-failure message, and emit `admin_otp_send_attempt` with `outcome: "acs_failed"` and `acs_send_status: "not_configured"`

#### Scenario: Deployed admin OTP smoke test uses ACS

- **GIVEN** the Function App has just been deployed or its Key Vault networking has changed
- **WHEN** an operator runs the documented admin OTP smoke test against an allow-listed test admin email
- **THEN** the test MUST exercise Azure Communication Services Email rather than a development skip path and MUST confirm that an OTP email is delivered or that a provider/configuration failure is reported with non-sensitive telemetry

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

The system SHALL expose `POST /api/portal-api/verify-otp` to validate a 6-digit OTP and establish an admin session using httpOnly JWT access and refresh cookies on success. OTP consumption SHALL be atomic so that a single valid code cannot be redeemed by two concurrent requests.

#### Scenario: Valid OTP verification

- **GIVEN** a valid, unexpired, unused OTP exists for the email
- **WHEN** `POST /api/portal-api/verify-otp` is called with `{ email, code }`
- **THEN** the system MUST atomically mark the OTP as used (`UPDATE ... SET used = 1 WHERE id = @id AND used = 0`), generate JWT access and refresh tokens signed with `JWT_SECRET`, set them as httpOnly cookies with secure environment-appropriate attributes, and return `{ ok: true }` without returning token strings in the JSON body

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

#### Scenario: Concurrent verification of the same code (race loser)

- **GIVEN** two concurrent verify requests carry the same valid, unused OTP code for the same email
- **WHEN** both requests pass the SELECT lookup and the lockout check
- **THEN** the atomic conditional UPDATE MUST succeed for exactly one request (`rowsAffected[0] === 1`), the race-loser MUST receive HTTP 401 with `{ ok: false, message: "Code already used. Please request a new one." }`, the race-loser MUST increment the lockout counter via the same path used by the explicit "already-used" branch, and the race-loser MUST NOT receive auth cookies

### Requirement: Admin session refresh and logout endpoints

The system SHALL expose admin session refresh and logout endpoints that operate on httpOnly JWT cookies without exposing refresh token material to browser JavaScript, AND SHALL enforce the admin Origin allowlist on both endpoints to prevent cross-origin session extension or forced logout.

#### Scenario: Refresh endpoint rotates session cookies

- **GIVEN** the request includes a valid admin refresh cookie and an `Origin` header that matches `ALLOWED_ORIGINS`
- **WHEN** `POST /api/portal-api/refresh` is called
- **THEN** the system MUST verify the refresh JWT, issue a new short-lived access cookie, rotate or renew the refresh cookie according to the configured session policy, and return `{ ok: true }` without returning token strings in the JSON body

#### Scenario: Refresh endpoint rejects invalid refresh cookie

- **GIVEN** the request has no valid admin refresh cookie but the `Origin` header is allowed
- **WHEN** `POST /api/portal-api/refresh` is called
- **THEN** the system MUST return HTTP 401 with `{ ok: false, message: "Unauthorized" }` and MUST NOT issue new auth cookies

#### Scenario: Refresh endpoint rejects forbidden origin

- **GIVEN** the request lacks an `Origin` header, or the `Origin` is not in `ALLOWED_ORIGINS`
- **WHEN** `POST /api/portal-api/refresh` is called
- **THEN** the system MUST return HTTP 403 with `{ ok: false, message: "Forbidden origin" }`, MUST NOT inspect or rotate the refresh cookie, and MUST NOT issue new auth cookies

#### Scenario: Logout endpoint clears auth cookies

- **GIVEN** an admin has access, refresh, or step-up cookies set, and the `Origin` header is allowed
- **WHEN** `POST /api/portal-api/logout` is called
- **THEN** the system MUST clear the admin auth cookies using matching cookie names, paths, domains, and security attributes, and return `{ ok: true }`

#### Scenario: Logout endpoint rejects forbidden origin

- **GIVEN** the request lacks an `Origin` header, or the `Origin` is not in `ALLOWED_ORIGINS`
- **WHEN** `POST /api/portal-api/logout` is called
- **THEN** the system MUST return HTTP 403 with `{ ok: false, message: "Forbidden origin" }` and MUST NOT clear or modify any cookies

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

### Requirement: Admin OTP send pipeline observability

The system SHALL emit a structured `admin_otp_send_attempt` log event on every terminal outcome of `POST /api/portal-api/request-otp` so operators can triage delivery failures without reproducing the issue and without exposing admin email addresses in plain text.

The event MUST include an `outcome` enum field with one of the following values: `sent`, `dev_skipped`, `acs_failed`, `acs_not_configured`, `rate_limited`, `not_authorised`, `not_configured`. The event MUST include an `email_hash` field containing a non-reversible identifier derived from the normalized request email so multiple attempts by the same admin can be correlated. The event MUST NOT include the admin email address in plain text in any field.

When the Azure Communication Services Email send is attempted (regardless of success), the event MUST include a numeric `latency_ms` field measuring the wall-clock duration of the send call. When ACS returns an operation identifier, the event MUST include it as `acs_message_id`. When the outcome is `acs_failed`, the event MUST include an `acs_send_status` field that distinguishes an SDK exception from a non-`Succeeded` terminal status from a missing ACS configuration.

The HTTP response shape, status codes, body messages, anti-enumeration behaviour, rate-limit window, and OTP TTL MUST remain unchanged.

#### Scenario: Successful ACS send is observable

- **GIVEN** an admin email is in the effective allow-list and ACS Email is configured
- **WHEN** `POST /api/portal-api/request-otp` is called and ACS Email reports `Succeeded`
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "sent"`, a non-empty `email_hash`, a numeric `latency_ms`, and an `acs_message_id` when one is returned by the ACS poller, AND the HTTP response MUST remain the existing friendly success body

#### Scenario: ACS send failure is observable with cause

- **GIVEN** an admin email is in the effective allow-list and ACS Email is configured
- **WHEN** `POST /api/portal-api/request-otp` is called and the ACS send throws or completes with a non-`Succeeded` status
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "acs_failed"`, a non-empty `email_hash`, a numeric `latency_ms`, an `acs_send_status` distinguishing exception from non-succeeded terminal status, and an `acs_message_id` when one was returned before the failure, AND the existing 503 response and OTP invalidation behaviour MUST be preserved

#### Scenario: Anti-enumeration "not authorised" branch is observable

- **GIVEN** the request email is NOT in the effective admin allow-list
- **WHEN** `POST /api/portal-api/request-otp` is called
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "not_authorised"` and a non-empty `email_hash`, AND the HTTP response MUST remain identical to the success response body so admin enumeration is not possible

#### Scenario: Rate-limited request is observable

- **GIVEN** an OTP was requested for the same admin email within the last 60 seconds
- **WHEN** `POST /api/portal-api/request-otp` is called
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "rate_limited"` and a non-empty `email_hash`, AND the HTTP response MUST remain HTTP 429 with the existing message

#### Scenario: Missing ACS configuration in production is observable

- **GIVEN** `NODE_ENV` is `production` and either `ACS_CONNECTION_STRING` or `ACS_EMAIL_SENDER` is not configured
- **WHEN** `POST /api/portal-api/request-otp` is called for an authorised admin email
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "acs_failed"` and `acs_send_status: "not_configured"`, AND the existing 503 response and OTP invalidation behaviour MUST be preserved

#### Scenario: Missing admin allow-list is observable

- **GIVEN** neither `ADMIN_EMAILS` nor active database-backed admin users are configured
- **WHEN** `POST /api/portal-api/request-otp` is called
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "not_configured"`, AND the HTTP response MUST remain HTTP 500 with the existing message

#### Scenario: Dev-mode skip is observable

- **GIVEN** `NODE_ENV` is not `production` and ACS Email is not configured
- **WHEN** `POST /api/portal-api/request-otp` is called for an authorised admin email
- **THEN** the system MUST emit one `admin_otp_send_attempt` log event with `outcome: "dev_skipped"` and a non-empty `email_hash`, AND the existing dev-mode behaviour (logging the OTP code locally and returning the friendly success response) MUST be preserved

#### Scenario: No log event contains the admin email in plain text

- **GIVEN** any of the outcomes above
- **WHEN** the `admin_otp_send_attempt` log event is emitted
- **THEN** no field of the event MUST contain the admin email address as plain text; only the `email_hash` derived identifier MUST be present
