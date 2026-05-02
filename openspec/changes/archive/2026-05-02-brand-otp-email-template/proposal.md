## Why

The current admin OTP email is plain text and uses older Copilot Bingo wording, which makes the login email feel less polished than the Capy experience shown in the product. A branded HTML email with a clear verification-code card will make admin sign-in easier to recognize while preserving the existing secure OTP behavior.

## What Changes

- Add a branded Capy HTML email template for admin OTP delivery through Azure Communication Services Email.
- Keep the plain-text fallback for email clients that block or do not render HTML.
- Preserve the existing 6-digit code, 10-minute expiry, single-use verification, anti-enumeration responses, failed-send invalidation, and non-sensitive telemetry behavior.
- Include safety copy that tells recipients they can ignore the email if they did not request the code.
- Avoid adding request metadata, links, or other dynamic content unless it can be sourced safely without weakening privacy or configuration contracts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `admin-auth`: Admin OTP email delivery must include a branded HTML template with a plain-text fallback while preserving the existing OTP security and delivery contract.

## Impact

- Affected backend code: `backend/src/lib/email.ts` and its email-helper tests.
- Affected runtime behavior: ACS Email payload content changes for admin OTP messages only; request and verification APIs remain unchanged.
- Affected dependencies: no new runtime dependency is expected.
- Affected teams: event operators and administrators who receive OTP emails; support operators who help troubleshoot admin login delivery.
- Rollback plan: revert the template change to the previous plain-text-only ACS Email payload. Existing OTP storage, verification, telemetry, and deployment settings remain compatible.
