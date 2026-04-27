## ADDED Requirements

### Requirement: Admin users table
The system SHALL store portal-managed admin email allow-list entries in an `admin_users` table or equivalent database-backed persistence.

#### Scenario: Admin user record structure
- **GIVEN** the admin user migration has run
- **WHEN** an admin user record is queried
- **THEN** the record MUST include a normalized email, active/disabled state, creation timestamp, creating admin identifier, and optional disabled timestamp and disabling admin identifier

#### Scenario: Admin email uniqueness
- **GIVEN** an admin email has already been added to database-backed admin users
- **WHEN** another add request is made for the same email with different casing or whitespace
- **THEN** the system MUST resolve it to the same normalized email and avoid duplicate active admin entries

### Requirement: Failed-send OTP invalidation
The system SHALL persist OTP state in a way that prevents verification of OTPs whose email delivery failed.

#### Scenario: OTP delivery fails after insert
- **GIVEN** an OTP record was inserted for an allow-listed admin email
- **WHEN** Azure Communication Services Email fails to send that OTP
- **THEN** the system MUST update the OTP record so the code cannot be successfully verified later