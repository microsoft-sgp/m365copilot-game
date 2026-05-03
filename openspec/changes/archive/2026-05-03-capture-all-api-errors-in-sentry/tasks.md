## 1. Frontend Sentry API Failure Capture

- [x] 1.1 Update `frontend/src/lib/sentry.ts` so `captureFrontendApiFailure` captures status `0` and every HTTP status `400` through `599`, with distinct classification, tags, context, and stable fingerprints for network, `4xx`, and `5xx` failures.
- [x] 1.2 Update `frontend/src/lib/api.ts` so public game/player API requests call `captureFrontendApiFailure` for every response status `400` through `599` while preserving existing response shapes and token side effects.
- [x] 1.3 Update admin API request handling so admin responses with status `400` through `599` are captured while preserving existing 401 invalid-session notification behavior.
- [x] 1.4 Update co-located frontend Sentry/API unit tests to cover captured `400`, `401`, `409`, `500`, and status `0` cases, plus filterable tags/fingerprints for `4xx` versus `5xx`.

## 2. Backend Returned Response Capture

- [x] 2.1 Add a backend Sentry helper that captures returned HTTP responses with status `400` through `599` using sanitized request context, function or route name, status class, runtime, service tags, and stable fingerprints without including raw request or response bodies.
- [x] 2.2 Update the Azure Functions Sentry wrapper so successful handler returns are inspected and returned `400` through `599` responses are captured without changing thrown exception capture or flush behavior.
- [x] 2.3 Update the local Express adapter so returned `400` through `599` responses are captured with local Express runtime tags while preserving returned status, body, headers, and cookies.
- [x] 2.4 Update co-located backend Sentry tests to cover returned `4xx`, returned `5xx`, existing thrown exceptions, disabled-DSN no-op behavior, and sanitization of request context.

## 3. Terraform And Deployment Configuration

- [x] 3.1 Set the Terraform `sentry_dsn` deployment input to the provided Sentry project DSN so the Function App receives a non-empty `SENTRY_DSN` through IaC.
- [x] 3.2 Ensure frontend build/deploy instructions or scripts pass the same DSN as `VITE_SENTRY_DSN` during `npm run build`, because Vite embeds the frontend DSN at build time.
- [x] 3.3 Ensure release/environment metadata stays aligned across frontend and backend deployment paths.
- [x] 3.4 Verify rollback remains configuration-only by documenting how to remove/empty the backend DSN and rebuild the frontend without `VITE_SENTRY_DSN`.

## 4. Verification

- [x] 4.1 Run frontend Vitest for the updated Sentry/API tests.
- [x] 4.2 Run backend Vitest for the updated Sentry wrapper/helper tests.
- [x] 4.3 Run `terraform -chdir=infra/terraform validate` after Terraform configuration changes.
- [x] 4.4 Run OpenSpec validation/status checks for `capture-all-api-errors-in-sentry` and confirm the change is apply-ready.
- [ ] 4.5 After deployment, trigger controlled frontend/backend `4xx` and `5xx` API responses and confirm Sentry receives sanitized, filterable events from both runtimes.
