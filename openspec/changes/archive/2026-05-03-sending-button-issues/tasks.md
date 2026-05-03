## 1. Request Status Model

- [x] 1.1 Define the shared slow-send threshold and request status states needed for `idle`, `sending`, `confirming`, `sent`, and failure outcomes.
- [x] 1.2 Add timer setup and cleanup so the slow-pending state appears only while a request is unresolved and cannot leak across retry, success, failure, or component unmount.

## 2. Frontend Implementation

- [x] 2.1 Update `AdminLogin.vue` so the Send Code action shows initial sending feedback, changes to a pending delivery-confirmation status after the threshold, blocks duplicate submissions while pending, and reveals the OTP input only after request success.
- [x] 2.2 Update `SetupPanel.vue` so the Player Recovery Send Code action uses the same slow-pending behavior, keeps recovery-code entry hidden until request success, and clears pending state on rate-limit or delivery failure.
- [x] 2.3 Add accessible status presentation for pending and confirmed send states without recording or exposing OTP/recovery code values.

## 3. Tests

- [x] 3.1 Update `AdminLogin.test.js` with fake-timer coverage for fast success, slow `Confirming delivery...` status, failure cleanup, and no OTP input before success.
- [x] 3.2 Update `SetupPanel.test.js` with fake-timer coverage for fast success, slow `Confirming delivery...` status, failure cleanup, and no recovery-code entry before success.
- [x] 3.3 Run the focused frontend Vitest tests for Admin Login and Setup Panel.

## 4. Verification

- [x] 4.1 Run `npm test` for the frontend package before marking the change complete.
- [x] 4.2 Review the final diff to confirm no backend API, ACS Email, database, token, or rate-limit behavior changed.
