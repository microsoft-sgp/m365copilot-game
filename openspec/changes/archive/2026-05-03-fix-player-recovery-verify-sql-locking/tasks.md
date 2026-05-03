## 1. Backend Locking Fix

- [x] 1.1 Update `backend/src/functions/verifyPlayerRecovery.ts` so the recovery-code lookup no longer combines `SERIALIZABLE` transaction isolation with the `READPAST` lock hint.
- [x] 1.2 Preserve atomic redemption behavior: valid codes create a device-token row and mark the OTP used in one commit, while failures after code match roll back without consuming the code.
- [x] 1.3 Preserve existing response and telemetry behavior for invalid codes, lockouts, service failures, successful verification, and player-token cookie issuance.

## 2. Regression Tests

- [x] 2.1 Update `backend/src/functions/verifyPlayerRecovery.test.js` to assert the serializable OTP lookup query does not include `READPAST` and still uses locking that supports double-redemption safety.
- [x] 2.2 Confirm existing tests still cover valid redemption, invalid/expired code rejection, lockout, double redemption, token-creation rollback, and missing-player service failure.
- [x] 2.3 Run focused backend Vitest coverage with `cd backend && npm test -- verifyPlayerRecovery`.

## 3. Deployment Validation

- [x] 3.1 Build or typecheck the backend with `cd backend && npm run build` before deployment.
- [x] 3.2 After backend deployment, request and verify a fresh recovery code for a claimed test player in the target environment.
- [x] 3.3 Query Application Insights to confirm `player_recovery_request` logs `outcome: "sent"`, `player_recovery_verify` logs `outcome: "verify_success"`, and SQL error 650 no longer appears for recovery verification.