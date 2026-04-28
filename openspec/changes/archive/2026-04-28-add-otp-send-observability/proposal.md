## Why

Today, when an admin reports "I never got the OTP email", we cannot tell from logs whether the code (a) blocked the email at the allow-list, (b) handed it to Azure Communication Services successfully, (c) was rejected by ACS, or (d) was dropped by the recipient mail system. The `requestOtp` function only writes a structured error log on the failure branch, and on the success branch produces no record of the attempt at all. The user-facing response is intentionally identical for "not authorised" and "sent successfully" (anti-enumeration), which means the API response cannot be used to triage either. The result is that operators have no way to distinguish a misconfiguration from a delivery failure without reproducing the issue under a debugger.

## What Changes

- Emit a structured info-level log on every OTP send attempt that records the outcome (`sent`, `dev_skipped`, `acs_failed`, `rate_limited`, `not_authorised`, `not_configured`) and a hashed/truncated email identifier suitable for correlation without storing PII in plain text.
- Capture and log the ACS Email operation id returned by `beginSend` / `pollUntilDone` so operators can correlate a Function invocation with an entry in the ACS Email Operations / message-trace tooling.
- Record send-attempt latency (milliseconds spent in `sendAdminOtpEmail`) in the structured log so operators can spot ACS slowness or polling timeouts.
- Add an `acs_send_status` dimension to the structured log on the failure path that distinguishes "ACS returned a non-Succeeded terminal status" from "ACS threw an exception" from "ACS not configured".
- Update the `admin-auth` spec so the observability behaviour is a documented requirement rather than an implementation detail, ensuring future refactors preserve it.
- No change to the HTTP response shape, the anti-enumeration behaviour, the rate-limit, the OTP TTL, or the email content. This change is observability-only.

## Capabilities

### New Capabilities

_None._ The behaviour belongs to an existing capability.

### Modified Capabilities

- `admin-auth`: Adds a requirement that the OTP request endpoint emits structured observability data covering every terminal outcome of the send pipeline, including the ACS operation id when one exists.

## Impact

- **Code**: `backend/src/lib/email.ts` (return shape extended with `messageId`/`status` fields), `backend/src/functions/requestOtp.ts` (structured log emission on every branch), and the corresponding test files.
- **Specs**: `openspec/specs/admin-auth/spec.md` gains an observability requirement (delta in this change).
- **APIs**: No external API changes. HTTP responses, status codes, and bodies are unchanged.
- **Dependencies**: No new packages. Uses the existing `@azure/communication-email` SDK return values and the `InvocationContext` logger already passed to the handler.
- **Privacy**: Email addresses MUST NOT be logged in plain text. A truncated SHA-256 prefix (or equivalent stable, non-reversible identifier) is used so multiple attempts by the same admin can be correlated without exposing the address itself.
- **Operations**: After this lands, operators triaging "no OTP arrived" reports will be able to filter Application Insights / Log Analytics for the structured outcome field and read the ACS operation id directly, removing the need to reproduce the issue.
- **Affected teams**: Backend (owns `requestOtp` and `email.ts`); Operations / on-call (consumes the new logs). No frontend, infra, or DB schema changes.

## Rollback Plan

The change is additive and confined to log emission plus an internal return-shape extension. To roll back, revert the `email.ts`, `requestOtp.ts`, and `admin-auth/spec.md` edits and redeploy; behaviour returns to the pre-change state with no data migration required. Because no log consumers (alerts, dashboards) are introduced as part of this change, removing the new log fields cannot break downstream systems.
