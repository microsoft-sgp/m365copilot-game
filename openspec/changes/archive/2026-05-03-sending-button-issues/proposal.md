## Why

Admin OTP and Player Recovery code requests can appear frozen when Azure Communication Services email delivery takes several seconds to confirm. The current UI only shows a static sending label during the backend wait, which makes normal provider latency feel like an unresponsive interface.

## What Changes

- Add a timed in-flight status progression for Admin OTP and Player Recovery send actions: initial `Sending...` feedback moves to a slower pending state such as `Confirming delivery...` when the backend has not responded after a short delay.
- Preserve existing backend contracts: OTP/recovery code entry is shown only after the request succeeds, delivery failures still surface as errors, rate limiting still shows the existing wait message, and no OTP or recovery code is exposed to the browser.
- Keep send controls protected from duplicate submissions while the request is pending, while giving users clearer visible progress during longer ACS delivery confirmation.
- Add frontend tests for fast success, slow pending status, failure, and cleanup behavior so stale timers do not leak across retries or component unmounts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-auth`: Admin login OTP request UI gains an explicit slow-pending status before confirmed success or failure while preserving the existing request endpoint and OTP-step gating.
- `player-identity`: Player recovery code request UI gains the same slow-pending status while continuing to show the code-entry step only when the request succeeds.

## Impact

- Affected code: `frontend/src/components/AdminLogin.vue`, `frontend/src/components/SetupPanel.vue`, and their focused Vitest coverage.
- Affected specs: `openspec/specs/admin-auth/spec.md` and `openspec/specs/player-identity/spec.md` via delta specs for request UI behavior.
- APIs and backend: no endpoint, response, ACS Email, database, token, or rate-limit changes.
- Observability: no new telemetry required; existing frontend Sentry capture for API failures remains unchanged.
- Affected teams: frontend maintainers, support/admin operators who explain OTP delivery delays, and event support staff helping players through recovery.
- Rollback plan: revert the frontend status-state changes and associated spec deltas; the backend email delivery behavior and API contracts remain unchanged throughout.
