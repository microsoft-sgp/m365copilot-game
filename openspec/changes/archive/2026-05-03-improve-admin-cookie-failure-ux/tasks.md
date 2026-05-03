## 1. Admin Session State Handling

- [x] 1.1 Add a small frontend admin-session helper or equivalent centralized functions for reading, setting, and clearing `sessionStorage.admin_authenticated` and `sessionStorage.admin_email`.
- [x] 1.2 Extend the admin API request layer so credentialed admin data calls can invoke an installed admin-session-invalid handler when they receive HTTP 401.
- [x] 1.3 Wire `App.vue` to install the admin-session-invalid handler, clear stale admin session markers, set a session-confirmation failure message, and return the user to the admin login view.
- [x] 1.4 Ensure `#/admin` route restoration still uses the existing refresh flow when no local marker exists and no longer treats the local marker as final proof once an admin API returns 401.

## 2. Admin Portal UX

- [x] 2.1 Update `AdminLogin.vue` or the app shell to display the session-confirmation failure message after a missing or invalid cookie-backed admin session is detected.
- [x] 2.2 Update `AdminDashboard.vue` so an HTTP 401 dashboard response does not render the generic "Failed to load dashboard" message and instead participates in the shared stale-session UX.
- [x] 2.3 Preserve the existing generic dashboard failure state for non-401 data-load failures.
- [x] 2.4 Confirm no admin JWT, refresh token, or step-up token material is introduced into `localStorage`, `sessionStorage`, or response JSON handling.

## 3. Unit And Browser Tests

- [x] 3.1 Add or update `frontend/src/lib/api.test.js` coverage for the admin-session-invalid handler on `adminRequest` HTTP 401 responses.
- [x] 3.2 Add or update `frontend/src/App.test.js` coverage showing that a stale `sessionStorage.admin_authenticated` marker is cleared when an authenticated admin API call returns 401.
- [x] 3.3 Add or update `frontend/src/components/AdminDashboard.test.js` coverage for HTTP 401 dashboard responses, asserting the generic dashboard failure message is not shown.
- [x] 3.4 Add or update `frontend/src/components/AdminLogin.test.js` or app-level tests to verify the session-confirmation failure message is displayed in the login flow.
- [x] 3.5 Add or update mocked Playwright admin coverage for OTP verification success followed by `GET /api/portal-api/dashboard` returning HTTP 401.

## 4. Verification

- [x] 4.1 Run the relevant frontend Vitest suite from `frontend/` and confirm the updated unit tests pass.
- [x] 4.2 Run the relevant mocked Playwright admin spec from `frontend/` and confirm the stale-cookie regression path passes.
- [x] 4.3 Run `openspec validate improve-admin-cookie-failure-ux --strict` and resolve any artifact validation issues.