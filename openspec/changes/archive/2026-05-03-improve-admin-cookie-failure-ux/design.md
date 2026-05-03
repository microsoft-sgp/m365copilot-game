## Context

Admin OTP verification establishes the real admin session with HttpOnly JWT cookies from `POST /api/portal-api/verify-otp`. The frontend also writes `sessionStorage.admin_authenticated=true` after a successful OTP response, and `App.vue` currently treats that browser-side marker as enough to render the admin portal on `#/admin`.

Production telemetry for the reported failure showed `verifyOtp` returning HTTP 200 followed immediately by `adminDashboard`, `adminListOrganizations`, `adminListCampaigns`, and `adminListAdmins` returning HTTP 401. That pattern indicates the OTP was accepted but the browser did not send a valid admin access cookie on subsequent credentialed requests. The dashboard endpoint then exits before SQL work, while the frontend collapses the response into the generic "Failed to load dashboard" state.

Current flow:

```text
AdminLogin
  POST /verify-otp -> 200, Set-Cookie admin_access/admin_refresh
  sessionStorage.admin_authenticated = true
        |
        v
App renders AdminLayout
        |
        v
AdminDashboard GET /dashboard
        |
        +-- cookie present   -> 200 -> dashboard data
        |
        +-- cookie missing   -> 401 -> "Failed to load dashboard"
```

Target flow:

```text
AdminLogin
  POST /verify-otp -> 200
  sessionStorage.admin_authenticated = true
        |
        v
First authenticated admin API call
        |
        +-- 200 -> keep admin view
        |
        +-- 401 -> clear sessionStorage marker
                  show session-confirmation message
                  return to admin login
```

## Goals / Non-Goals

**Goals:**

- Treat `sessionStorage.admin_authenticated` as a UI hint, not as proof that the cookie-backed admin session is usable.
- Clear admin session markers when authenticated admin API calls return HTTP 401.
- Show a message that distinguishes missing or rejected admin session cookies from dashboard data-load failures.
- Keep admin JWT and refresh token material out of browser JavaScript.
- Cover the missing-cookie-after-OTP path with focused unit and Playwright tests.

**Non-Goals:**

- Changing backend OTP, JWT signing, cookie attributes, CORS, origin allowlist, or admin authorization semantics.
- Adding bearer-token fallback for admin browser requests.
- Solving the broader cross-origin cookie architecture by introducing a same-origin proxy or custom-domain routing.
- Changing database schema, migrations, admin email allow-list behavior, or dashboard SQL queries.

## Decisions

### 1. Use HTTP 401 from admin API calls as the frontend session invalidation signal

Admin APIs already return 401 when no valid admin access token is present. The frontend should interpret a 401 from credentialed admin data endpoints as evidence that the browser-side admin marker is stale or unsupported by cookies.

Alternatives considered:

- **Preflight with `POST /refresh` after OTP success:** This confirms refresh-cookie transport but adds another request before every login completion and still does not cover later access-cookie loss.
- **Decode or store JWTs in JavaScript:** Rejected because admin auth intentionally uses HttpOnly cookies and must not expose token material to browser storage.

### 2. Centralize admin invalidation handling rather than special-casing only the dashboard

The observed failure affected every authenticated admin endpoint, not just `GET /dashboard`. The implementation should use a shared frontend handler for `adminRequest` 401 responses so Organizations, Campaigns, Players, Admin Access, and export calls do not each invent separate stale-session behavior.

Alternatives considered:

- **Dashboard-only handling:** Minimal, but leaves the rest of the admin portal able to show inconsistent generic failures.
- **Backend-specific error code:** Useful long-term, but unnecessary for the current behavior because HTTP 401 already carries the required meaning.

### 3. Return the user to the admin login flow with a session-confirmation message

When the cookie-backed session cannot be confirmed, the frontend should clear `admin_authenticated` and `admin_email`, move out of the admin portal view, and show an admin-login message such as "Your admin session could not be confirmed. Please sign in again." This keeps the user in a recoverable path and avoids implying that dashboard data itself failed.

Alternatives considered:

- **Keep the user on the dashboard with an inline error:** This satisfies the copy requirement, but leaves the app in an authenticated admin shell even though the backend rejected the session.
- **Silently retry OTP or refresh:** OTP cannot be retried without user input, and refresh also depends on cookies that may be missing.

### 4. Keep the backend contract unchanged

The telemetry points to frontend state and browser cookie transport, not backend auth, SQL, or admin email allow-list logic. The fix should make the existing frontend honest about failed cookie confirmation while preserving current security posture.

Alternatives considered:

- **Expose admin access tokens in JSON as a fallback:** Rejected because it weakens the HttpOnly-cookie design.
- **Relax backend auth to trust `sessionStorage`-derived state:** Impossible and insecure; the server cannot trust browser storage.

## Risks / Trade-offs

- [Risk] A transient 401 from an expired access cookie could force re-login even when the refresh cookie is still valid. -> Mitigation: preserve the existing route-level refresh behavior and consider a future retry-once refresh path for admin data calls if access-cookie expiry becomes common.
- [Risk] Centralized 401 handling could redirect while a child component is still updating state. -> Mitigation: make the handler idempotent, clear session markers before view transitions, and keep component-level fallback text for tests or direct rendering.
- [Risk] The UX message might over-specify cookies for non-cookie 401 causes. -> Mitigation: phrase the message around confirming the admin session, not browser internals.
- [Risk] This does not fix mobile cross-origin cookie blocking itself. -> Mitigation: document that same-origin API routing remains the architectural fix; this change makes the failure understandable and recoverable.

## Migration Plan

1. Add frontend session-marker helpers or centralize the existing direct `sessionStorage` reads/writes.
2. Install a frontend admin-unauthorized handler from the app shell and have credentialed admin API calls invoke it on HTTP 401.
3. Update admin login/dashboard state to display a session-confirmation failure message instead of the generic dashboard failure for unauthorized responses.
4. Add/update unit tests for App route handling, AdminDashboard unauthorized state, and API admin 401 handling.
5. Add/update Playwright mocked admin coverage for successful OTP followed by dashboard/admin API 401.
6. Roll back by reverting the frontend handler/message changes; no backend setting, database, or migration rollback is required.

## Open Questions

- Should the implementation retry `POST /api/portal-api/refresh` once before declaring an admin data-call 401 invalid, or should that be deferred until there is evidence of access-token expiry causing false logouts?
- Should the session-confirmation message mention mobile/browser privacy settings directly, or stay generic to avoid overexplaining in the product UI?