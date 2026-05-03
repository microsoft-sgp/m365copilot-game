## Why

Browser-visible API failures are not consistently visible in Sentry today. The current implementation intentionally ignores expected `4xx` responses and the deployed environment has Sentry DSN configuration gaps, which makes recovery, authentication, validation, and conflict failures hard to correlate across frontend and backend.

## What Changes

- Capture every frontend API failure response with HTTP status `400` through `599`, plus network failures with status `0`, in Sentry.
- Capture backend HTTP handler responses with HTTP status `400` through `599` in Sentry, including handled responses that do not throw exceptions.
- Keep existing API response bodies, status codes, cookies, and retry/session behavior unchanged.
- Tag and fingerprint events so expected `4xx` responses can be filtered separately from unexpected `5xx` failures.
- Enable Sentry for both deployed frontend and backend using the same Sentry project DSN and shared release/environment metadata.
- Update Terraform/deployment configuration so the backend Function App receives `SENTRY_DSN`, and document/build the frontend with `VITE_SENTRY_DSN` at build time.
- Preserve privacy filtering so emails, recovery codes, OTP values, cookies, tokens, authorization headers, and connection strings are redacted before leaving the app.
- Rollback plan: remove or empty Sentry DSN settings, rebuild the frontend without `VITE_SENTRY_DSN`, and redeploy so Sentry initialization returns to disabled/no-op behavior while Application Insights remains available.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `sentry-observability`: API response capture requirements change from selected failures only to all frontend and backend API responses with HTTP status `400` through `599`.

## Impact

- Frontend: `frontend/src/lib/api.ts`, `frontend/src/lib/sentry.ts`, Sentry unit tests, and frontend build/deploy environment variables.
- Backend: Azure Functions Sentry wrapper/helper, local Express adapter Sentry capture behavior, backend Sentry unit tests, and Function App runtime settings.
- Infrastructure: Terraform Sentry variables and app settings, especially `sentry_dsn` for the Function App.
- Deployment: frontend builds must provide `VITE_SENTRY_DSN`; backend deployments must apply the Terraform Sentry DSN setting.
- Affected teams: application developers, operators/on-call, and anyone using Sentry issue triage for player/admin support workflows.
