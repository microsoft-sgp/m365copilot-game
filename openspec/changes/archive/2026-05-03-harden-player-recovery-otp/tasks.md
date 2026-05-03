## 1. Branded Recovery Email

- [x] 1.1 Refactor the OTP email renderer in `backend/src/lib/email.ts` so admin OTP and player recovery can share the branded HTML/plain-text structure while keeping flow-specific subjects and copy.
- [x] 1.2 Update `sendPlayerRecoveryEmail` to send `content.html` and `content.plainText` with the 6-digit recovery code, 10-minute expiry copy, ignore-this-email copy, and existing recipient address.
- [x] 1.3 Preserve admin OTP email payload behavior and security-sensitive exclusions while refactoring shared email code.
- [x] 1.4 Update `backend/src/lib/email.test.js` to assert the player recovery ACS payload includes branded HTML, plain text, player-specific copy, spaced code display, expiry copy, and no secrets/tokens/hashes.

## 2. Recovery Verification Safety

- [x] 2.1 Update `backend/src/functions/verifyPlayerRecovery.ts` so matching recovery-code consumption and player device-token creation commit atomically in one database transaction.
- [x] 2.2 Ensure failures after a matching unused code is found roll back the transaction, leave the code reusable until expiry, avoid partial device-token rows, and return a retry-later service failure.
- [x] 2.3 Preserve existing invalid-code, lockout, double-redemption, player-token cookie, and admin-separation behavior.
- [x] 2.4 Update `backend/src/functions/verifyPlayerRecovery.test.js` to cover successful atomic redemption, invalid/expired codes, double redemption, and token-creation failure without code consumption.

## 3. Frontend Recovery Errors

- [x] 3.1 Update the recovery verification UI/API handling so HTTP 401 shows the invalid-or-expired code message.
- [x] 3.2 Show a retry-later service-failure message for HTTP 5xx, status `0`, or malformed/missing recovery verification response data.
- [x] 3.3 Keep the player recovery flow blocked until verification succeeds, and preserve the existing successful recovery launch/hydration behavior.
- [x] 3.4 Update `frontend/src/components/SetupPanel.test.js` or adjacent frontend tests to cover invalid-code versus service-failure messaging.

## 4. Validation

- [x] 4.1 Run backend Vitest coverage relevant to email and player recovery functions.
- [x] 4.2 Run frontend Vitest coverage relevant to setup/recovery UI behavior.
- [x] 4.3 Run OpenSpec validation/status checks for `harden-player-recovery-otp` and confirm the change is apply-ready.
