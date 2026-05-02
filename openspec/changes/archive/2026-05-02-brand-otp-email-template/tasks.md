## 1. Email Template Implementation

- [x] 1.1 Add a small admin OTP email renderer in `backend/src/lib/email.ts` that returns the Capy subject, plain-text fallback, and inline-styled HTML body using only the OTP code as dynamic content.
- [x] 1.2 Update `sendAdminOtpEmail` to pass the renderer output to Azure Communication Services Email via `content.subject`, `content.plainText`, and `content.html` while preserving existing configuration handling, development skip behavior, polling, and result mapping.
- [x] 1.3 Confirm `sendPlayerRecoveryEmail` remains behaviorally unchanged in this change.

## 2. Unit Test Coverage

- [x] 2.1 Extend `backend/src/lib/email.test.js` to assert the admin OTP ACS payload includes the Capy subject, plain-text fallback, HTML body, 6-digit code, 10-minute expiry copy, and existing recipient address.
- [x] 2.2 Add test assertions that the rendered admin OTP email content does not include provider secrets, connection strings, JWT wording, OTP hashes, raw telemetry fields, request IP text, or retry-link URLs.
- [x] 2.3 Verify existing admin OTP provider failure, not-configured, development skip, and player recovery email tests still pass without behavior changes.

## 3. Validation

- [x] 3.1 Run `npm test -- --run backend/src/lib/email.test.js` from `backend/` and fix any regressions in the email helper tests.
- [x] 3.2 Run `npm test -- --run backend/src/functions/requestOtp.test.js` from `backend/` to confirm request behavior remains unchanged.
- [x] 3.3 Run `npm run typecheck` from `backend/` to confirm the TypeScript email helper changes compile.
- [x] 3.4 Run `openspec status --change "brand-otp-email-template"` and confirm the change is apply-ready.
