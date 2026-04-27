## Why

The admin portal currently has an OTP login flow, but the backend does not yet send OTP codes through the configured email service. This leaves production admin login dependent on non-production log output behavior and creates a gap between the admin-auth spec and runtime behavior.

Admin access is also configured only through the `ADMIN_EMAILS` app setting. That works as an initial bootstrap allow-list, but it does not let an authenticated admin add or remove another admin from the portal. Because admin allow-list changes are highly privileged, they should require a fresh OTP challenge before they are applied, even when the admin already has a valid JWT session.

## What Changes

- Send admin OTP codes through Azure Communication Services Email using Function App configuration.
- Preserve the 10-minute OTP expiry requirement and keep OTPs single-use.
- If ACS Email cannot send a code for an allow-listed admin, return an explicit provider failure and invalidate the stored OTP so it cannot later be used.
- Add database-backed admin allow-list management, with `ADMIN_EMAILS` retained as bootstrap/break-glass configuration.
- Add authenticated admin endpoints and portal UI for listing, adding, disabling/removing admin emails.
- Require a fresh OTP re-verification before adding or removing admin emails from the portal.
- Add tests and deployment documentation for ACS Email configuration and admin allow-list management.

## Capabilities

### New Capabilities

- `admin-user-management`: Portal-managed admin email allow-list with step-up OTP verification before add/remove operations.

### Modified Capabilities

- `admin-auth`: OTP delivery must use Azure Communication Services Email, preserve expiry, invalidate failed-send OTPs, and support step-up OTP verification for sensitive admin changes.
- `admin-portal`: Add admin allow-list management UI and require fresh OTP confirmation before admin add/remove actions.
- `game-database`: Add persistence for portal-managed admin users and any state needed to audit admin allow-list changes.

## Impact

- Affected backend code: `requestOtp`, `verifyOtp`, admin auth helpers, new admin user management functions, and tests.
- Affected frontend code: admin portal navigation/views and API client functions for admin allow-list management and step-up OTP verification.
- Affected database: new admin users/audit persistence plus migration-safe bootstrap from `ADMIN_EMAILS` behavior.
- Affected deployment: new ACS Email app settings such as connection string and sender address; existing `ADMIN_EMAILS` remains as bootstrap/break-glass.
- Affected teams: backend/API, frontend/admin portal, DevOps, QA, event operations.
- Rollback plan: keep `ADMIN_EMAILS` and `x-admin-key` fallback paths available; disable portal-managed admin endpoints/UI if ACS or admin-user persistence causes issues; leave additive schema in place while reverting runtime reads to environment-only allow-list.