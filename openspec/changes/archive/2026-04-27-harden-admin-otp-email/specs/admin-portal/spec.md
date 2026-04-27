## ADDED Requirements

### Requirement: Admin management portal view
The system SHALL provide an admin management view where authenticated admins can list, add, and disable portal-managed admin emails.

#### Scenario: Admin navigation includes admin management
- **GIVEN** the admin portal renders for an authenticated admin
- **WHEN** the navigation is displayed
- **THEN** the system MUST include an Admins or Admin Access view alongside Dashboard, Organizations, Campaign Settings, Players, and Danger Zone

#### Scenario: Admin adds email with OTP step-up
- **GIVEN** the admin is on the admin management view
- **WHEN** the admin chooses to add an email
- **THEN** the UI MUST require the acting admin to re-enter an OTP before submitting the add request

#### Scenario: Admin removes email with OTP step-up
- **GIVEN** the admin is on the admin management view
- **WHEN** the admin chooses to remove or disable an admin email
- **THEN** the UI MUST require the acting admin to re-enter an OTP before submitting the remove or disable request

#### Scenario: Step-up OTP fails
- **GIVEN** the acting admin enters an invalid, expired, or already-used OTP during an admin-management action
- **WHEN** the verification response fails
- **THEN** the UI MUST keep the admin email mutation unsubmitted and display the verification failure message