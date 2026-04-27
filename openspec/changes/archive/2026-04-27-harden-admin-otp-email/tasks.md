## 1. Database and Configuration

- [x] 1.1 Add migration for `admin_users` persistence with normalized unique email, active/disabled state, created/disabled metadata, and audit fields.
- [x] 1.2 Add any OTP state changes needed to invalidate failed-send OTPs, using existing `used` semantics if no new status column is introduced.
- [x] 1.3 Update local DB initialization and deployment docs to include admin user schema and ACS Email settings.
- [x] 1.4 Document `ADMIN_EMAILS` as bootstrap/break-glass admins and database-backed admins as portal-managed admins.

## 2. ACS Email OTP Delivery

- [x] 2.1 Add Azure Communication Services Email dependency and an email provider helper for sending admin OTP messages.
- [x] 2.2 Update `POST /api/portal-api/request-otp` to use the effective admin allow-list from `ADMIN_EMAILS` plus active database-backed admins.
- [x] 2.3 Preserve 10-minute OTP expiry and single-use verification behavior for all admin OTPs.
- [x] 2.4 On ACS send failure for an allow-listed admin, invalidate the inserted OTP and return HTTP 502 or 503 with a generic delivery-failure message.
- [x] 2.5 Keep non-admin OTP requests enumeration-safe: return generic success without storing an OTP or sending email.

## 3. Step-Up OTP Authorization

- [x] 3.1 Add backend support for short-lived admin-management OTP proof after the acting admin re-verifies their own OTP.
- [x] 3.2 Require fresh admin-management OTP proof before add, disable, remove, or reactivate admin email operations.
- [x] 3.3 Reject admin-management mutations with HTTP 403 when proof is missing, expired, invalid, or scoped to another action/admin.
- [x] 3.4 Ensure failed, expired, or used step-up OTP attempts do not mutate admin users.

## 4. Admin User Management API

- [x] 4.1 Add authenticated endpoint to list effective admins, distinguishing read-only bootstrap admins from portal-managed admins.
- [x] 4.2 Add authenticated endpoint to add or reactivate a portal-managed admin email, guarded by step-up OTP proof.
- [x] 4.3 Add authenticated endpoint to disable or remove a portal-managed admin email, guarded by step-up OTP proof.
- [x] 4.4 Prevent portal removal of `ADMIN_EMAILS` bootstrap admins and prevent lockout when no bootstrap or active database admin would remain.

## 5. Admin Portal UI

- [x] 5.1 Add Admins/Admin Access navigation and view to the admin portal.
- [x] 5.2 Display effective admins with source labels for bootstrap vs portal-managed entries.
- [x] 5.3 Require re-entering OTP in the UI before submitting add/remove admin operations.
- [x] 5.4 Keep add/remove requests unsubmitted and show verification errors when step-up OTP fails.

## 6. Tests and Validation

- [x] 6.1 Add backend tests for ACS Email success, provider failure, failed-send OTP invalidation, and non-admin enumeration-safe behavior.
- [x] 6.2 Add backend tests for database-backed admin allow-list resolution and bootstrap `ADMIN_EMAILS` fallback.
- [x] 6.3 Add backend tests proving admin add/remove requires fresh OTP proof and rejects missing or expired proof.
- [x] 6.4 Add frontend tests for Admins view listing, source labels, and OTP step-up prompts before add/remove.
- [x] 6.5 Run backend and frontend test suites plus OpenSpec validation for `harden-admin-otp-email`.