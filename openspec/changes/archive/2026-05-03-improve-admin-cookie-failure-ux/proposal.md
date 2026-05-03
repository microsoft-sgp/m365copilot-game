## Why

Some admins can complete OTP verification successfully but then see a generic "Failed to load dashboard" message because the browser does not send the HttpOnly admin session cookie on the first authenticated admin API call. The current frontend treats `sessionStorage.admin_authenticated` as sufficient proof of an admin session, which hides session-cookie transport failures and leaves the user in a broken portal state.

## What Changes

- Validate the cookie-backed admin session with the first authenticated admin API response instead of relying solely on `sessionStorage.admin_authenticated`.
- When an admin API call returns HTTP 401 immediately after OTP login or route restoration, clear the frontend admin-authenticated marker and send the user back to the admin login flow.
- Replace the generic dashboard failure copy for unauthorized admin responses with a session-cookie-specific message that explains the admin session could not be confirmed and prompts the user to sign in again.
- Preserve the existing backend OTP, JWT, CORS, and admin API contracts; this change is frontend UX/session-state handling only.
- Add unit and browser-test coverage for stale or missing admin cookies after OTP verification.
- Rollback plan: revert the frontend state-handling and message changes; backend auth remains unchanged, so rollback restores the previous generic dashboard failure behavior without database or API migration work.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `admin-portal`: Admin portal frontend behavior for invalid or missing cookie-backed admin sessions is changing.
- `automated-functional-testing`: Admin functional coverage must include the missing-cookie/unauthorized-after-login regression path.

## Impact

- Affected frontend code: admin route/session handling in `frontend/src/App.vue`, dashboard error handling in `frontend/src/components/AdminDashboard.vue`, and related admin component tests.
- Affected browser tests: mocked admin Playwright flows that cover OTP login, dashboard load, and unauthorized admin API responses.
- Affected APIs: no API shape changes; frontend continues to call existing `POST /api/portal-api/verify-otp`, `POST /api/portal-api/refresh`, and `GET /api/portal-api/dashboard` endpoints with credentials.
- Affected teams: frontend/admin portal owners, QA/test automation owners, and operations/on-call teams who triage admin login issues.