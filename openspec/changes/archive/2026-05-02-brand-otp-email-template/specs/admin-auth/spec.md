## ADDED Requirements

### Requirement: Admin OTP branded email content
The system SHALL send admin OTP messages through Azure Communication Services Email with branded Capy HTML content and a plain-text fallback while preserving the existing admin OTP request, delivery failure, anti-enumeration, telemetry, and verification behavior.

#### Scenario: Admin OTP email includes branded HTML and plain text
- **GIVEN** an email is in the effective admin allow-list and Azure Communication Services Email is configured with resolved runtime settings
- **WHEN** `POST /api/portal-api/request-otp` sends the admin OTP message
- **THEN** the ACS Email payload MUST include `content.html` containing Capy-branded verification-code content, `content.plainText` containing the same 6-digit code and 10-minute expiry information, and the existing recipient address

#### Scenario: Branded email preserves security-sensitive behavior
- **GIVEN** an admin OTP email is rendered for delivery
- **WHEN** the email body is constructed
- **THEN** the rendered content MUST NOT include provider secrets, connection strings, raw telemetry fields, JWTs, OTP hashes, or any value that is not required for the recipient to complete the OTP challenge

#### Scenario: Admin OTP delivery behavior remains unchanged
- **GIVEN** an admin OTP request succeeds, is skipped in local development, is rate limited, targets a non-admin email, or fails because ACS Email cannot send
- **WHEN** the request completes
- **THEN** the HTTP response shape, status codes, OTP storage and invalidation behavior, telemetry event names and non-sensitive fields, 60-second request cooldown, and 10-minute OTP expiry MUST remain unchanged from the existing admin OTP contract
