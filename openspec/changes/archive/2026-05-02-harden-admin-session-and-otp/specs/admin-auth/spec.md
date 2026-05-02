## MODIFIED Requirements

### Requirement: Admin OTP verification endpoint

The system SHALL expose `POST /api/portal-api/verify-otp` to validate a 6-digit OTP and establish an admin session using httpOnly JWT access and refresh cookies on success. OTP consumption SHALL be atomic so that a single valid code cannot be redeemed by two concurrent requests.

#### Scenario: Valid OTP verification

- **GIVEN** a valid, unexpired, unused OTP exists for the email
- **WHEN** `POST /api/portal-api/verify-otp` is called with `{ email, code }`
- **THEN** the system MUST atomically mark the OTP as used (`UPDATE … SET used = 1 WHERE id = @id AND used = 0`), generate JWT access and refresh tokens signed with `JWT_SECRET`, set them as httpOnly cookies with secure environment-appropriate attributes, and return `{ ok: true }` without returning token strings in the JSON body

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
