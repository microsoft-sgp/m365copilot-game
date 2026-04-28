## ADDED Requirements

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
