## 1. Email helper return-shape extension

- [x] 1.1 Extend `EmailSendResult` in [backend/src/lib/email.ts](backend/src/lib/email.ts) to a discriminated union that always carries `latencyMs` and optionally carries `messageId`, plus a `status` discriminator on the failure variant (`exception` | `non_succeeded` | `not_configured`) and an `acsStatus` field for the non-succeeded case.
- [x] 1.2 Wrap the body of `sendAdminOtpEmail` in a `Date.now()` start/end pair and populate `latencyMs` on every return path (success, dev-skipped, not-configured, non-succeeded status, thrown exception).
- [x] 1.3 Read the ACS operation id defensively from the poller after `pollUntilDone()` resolves and populate `messageId` when available, treating its absence as non-fatal.
- [x] 1.4 Map the existing not-configured production path to `{ ok: false, status: 'not_configured', latencyMs: 0 }` without changing the existing `error` string.
- [x] 1.5 Map the existing non-`Succeeded` poller status path to `{ ok: false, status: 'non_succeeded', acsStatus: <status>, latencyMs, messageId? }`.
- [x] 1.6 Map the existing `catch (err)` path to `{ ok: false, status: 'exception', latencyMs, messageId? }` and preserve the existing `context.error('Failed to send admin OTP email', err)` call unchanged.

## 2. Structured log emission in `requestOtp`

- [x] 2.1 Add an internal helper in [backend/src/functions/requestOtp.ts](backend/src/functions/requestOtp.ts) that computes a 12-character SHA-256 prefix of the normalized email (reusing `createHash` directly or a small local helper; do not export from `adminAuth.ts` to avoid coupling).
- [x] 2.2 Add a single `logSendAttempt(context, { outcome, emailHash, ... })` helper inside `requestOtp.ts` that emits `context.log('admin_otp_send_attempt', { ... })` and is called exactly once per terminal branch.
- [x] 2.3 Emit `outcome: 'not_configured'` on the early-return when `getEffectiveAdminEmails` is empty (no `email_hash` field necessary because the request hasn't been validated; document this exception in the helper's call site).
- [x] 2.4 Emit `outcome: 'not_authorised'` with `email_hash` on the silent-success branch when the email is not in the allow-list.
- [x] 2.5 Emit `outcome: 'rate_limited'` with `email_hash` on the 60-second window branch.
- [x] 2.6 Emit `outcome: 'sent'` with `email_hash`, `latency_ms`, and `acs_message_id` (when present) on the successful ACS send.
- [x] 2.7 Emit `outcome: 'dev_skipped'` with `email_hash` and `latency_ms` on the dev-mode skipped branch (`result.skipped === true`).
- [x] 2.8 Emit `outcome: 'acs_failed'` with `email_hash`, `latency_ms`, `acs_send_status` (mapped from the result's `status`), `acs_message_id` (when present), and `error_name` (when present) on the failure branch, retaining the existing 503 response and OTP invalidation.
- [x] 2.9 Verify by code review that no log emission anywhere in the file passes the bare email string as a field value.

## 3. Backend tests

- [x] 3.1 Update [backend/src/lib/email.test.js](backend/src/lib/email.test.js) to assert the new fields on each return-shape variant: success carries `latencyMs` and (when mocked) `messageId`; failure carries `status` and `latencyMs`; dev-skipped carries `latencyMs`.
- [x] 3.2 Add a test that mocks the ACS poller's terminal status as something other than `Succeeded` and asserts the result has `status: 'non_succeeded'` and `acsStatus: '<status>'`.
- [x] 3.3 Update [backend/src/functions/requestOtp.test.js](backend/src/functions/requestOtp.test.js) to assert that exactly one `context.log('admin_otp_send_attempt', { ... })` call is made on each branch (success, dev-skipped, ACS-failed, rate-limited, not-authorised, not-configured) with the expected `outcome` value.
- [x] 3.4 Add a test that asserts the emitted log fields never contain the original email string (e.g., scan all `context.log` call args for the bare email).
- [x] 3.5 Add a test that asserts `email_hash` is the same value for two requests using the same email after normalization (e.g., `Foo@Example.com` and `foo@example.com`).
- [x] 3.6 Run `npm --prefix backend test` and confirm the suite is green; do not mark this task group complete until it is.

## 4. Spec sync and verification

- [x] 4.1 Confirm the change validates: `openspec validate add-otp-send-observability --strict` returns ok.
- [x] 4.2 Confirm `openspec status --change add-otp-send-observability` shows all artifacts complete.
- [x] 4.3 After implementation, run the openspec-archive-change skill to fold the spec delta into [openspec/specs/admin-auth/spec.md](openspec/specs/admin-auth/spec.md).
