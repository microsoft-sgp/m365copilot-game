# admin-user-management

## Purpose

Defines portal-managed admin email allow-list behavior and audit metadata for admin access management.

## Requirements

### Requirement: Portal-managed admin email allow-list

The system SHALL allow authenticated admins to view and manage database-backed admin email entries from the admin portal.

#### Scenario: Admin lists effective admins

- **GIVEN** an admin is authenticated
- **WHEN** the admin opens the admin management view
- **THEN** the system MUST show active database-backed admins and bootstrap admins from `ADMIN_EMAILS`, clearly distinguishing read-only bootstrap entries from portal-managed entries

#### Scenario: Admin adds another admin email

- **GIVEN** an admin is authenticated and has completed a fresh admin-management OTP step-up
- **WHEN** the admin submits a valid email address to add
- **THEN** the system MUST normalize the email to lowercase, create or reactivate a database-backed admin user entry, record who created the entry, and allow the new admin email to request OTP login codes

#### Scenario: Admin removes another admin email

- **GIVEN** an admin is authenticated and has completed a fresh admin-management OTP step-up
- **WHEN** the admin removes a portal-managed admin email
- **THEN** the system MUST disable or remove that database-backed admin user entry and prevent that email from receiving future admin OTP login codes unless it remains present in `ADMIN_EMAILS`

#### Scenario: Admin cannot remove bootstrap admin from portal

- **GIVEN** an admin email is present only through the `ADMIN_EMAILS` app setting
- **WHEN** an admin attempts to remove it through the portal
- **THEN** the system MUST reject the mutation and explain that bootstrap admins are managed through Function App settings

#### Scenario: Admin cannot remove the last active portal-managed admin without fallback

- **GIVEN** removing an admin would leave no active database-backed admins and no configured bootstrap admins
- **WHEN** the admin attempts the removal
- **THEN** the system MUST reject the request to avoid locking out admin access

### Requirement: Admin management audit trail

The system SHALL retain enough metadata to audit admin allow-list changes.

#### Scenario: Admin user entry is created

- **GIVEN** an admin adds another admin email
- **WHEN** the database-backed admin user entry is stored
- **THEN** the system MUST store the normalized email, active status, creation timestamp, and creating admin email

#### Scenario: Admin user entry is disabled

- **GIVEN** an admin disables or removes another admin email
- **WHEN** the database-backed admin user entry is updated
- **THEN** the system MUST store the disabled timestamp and disabling admin email
