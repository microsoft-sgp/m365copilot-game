## 1. Telemetry Classification Foundation

- [x] 1.1 Add frontend API outcome classification that distinguishes `status: 0`, `5xx`, ordinary `4xx`, and selected operational response classes using sanitized low-cardinality attributes.
- [x] 1.2 Add backend HTTP response classification that distinguishes thrown exceptions, returned `5xx`, ordinary returned `4xx`, and selected operational response classes using sanitized low-cardinality attributes.
- [x] 1.3 Update Sentry issue capture helpers so `status: 0`, `5xx`, unexpected exceptions, and selected operational failures remain Issues while ordinary `4xx` outcomes do not create Issues by default.
- [x] 1.4 Add shared or parallel metric naming/tag conventions for ordinary `4xx` response metrics across frontend and backend.

## 2. Frontend Logging And API Behavior

- [x] 2.1 Update the frontend Sentry helper to emit application logs through Sentry Logs rather than `captureMessage`, including sanitized structured attributes and service/runtime tags.
- [x] 2.2 Add frontend log sanitization coverage for sensitive keys, emails, tokens, OTPs, recovery codes, connection strings, request context, and message attributes.
- [x] 2.3 Update the frontend API helper so ordinary `400` through `499` responses emit Sentry Logs and metrics while preserving the existing `ApiResponse` contract and token/cookie side effects.
- [x] 2.4 Preserve frontend Issue capture for browser `status: 0` network failures and backend `500` through `599` responses.
- [x] 2.5 Add frontend logs or breadcrumbs for nonfatal clipboard copy failures and swallowed game-auth watcher promise failures.
- [x] 2.6 Add or update co-located frontend Vitest tests for API classification, ordinary `4xx` log behavior, `status: 0` and `5xx` Issue behavior, log sanitization, and nonfatal UI logging.

## 3. Backend Logging And Response Behavior

- [x] 3.1 Update the backend Sentry helper to emit application logs through Sentry Logs rather than `captureMessage`, including sanitized structured attributes and service/runtime tags.
- [x] 3.2 Add a backend application logging helper that preserves Azure `context.log` or `context.error` output while also emitting sanitized Sentry Logs when Sentry is configured.
- [x] 3.3 Update backend returned-response handling so ordinary returned `400` through `499` responses emit Sentry Logs and metrics without creating Issues by default.
- [x] 3.4 Preserve backend Issue capture and flush behavior for unexpected handler exceptions, local Express adapter exceptions, returned `500` through `599` responses, and ACS Email operational failures.
- [x] 3.5 Route existing backend operational logs through the Sentry-aware logging helper for admin OTP send/verify, player recovery request/verify, Redis cache fallbacks, pack assignment resolution/reroll, and local Express handler errors.
- [x] 3.6 Add or update co-located backend Vitest tests for backend classification, ordinary `4xx` log behavior, `5xx` Issue behavior, preserved platform logging, log sanitization, metrics, and ACS Email operational Issue behavior.

## 4. Documentation And Live Verification Path

- [x] 4.1 Update deployment or operations documentation to state that ordinary `4xx` workflow responses are Sentry Logs/metrics by default while breakage remains in Sentry Issues.
- [x] 4.2 Document the non-production Sentry live verification procedure for frontend Issue, backend Issue, structured Log, metric, trace, masked replay, and source-map-resolved stack traces.
- [x] 4.3 Document required Sentry build/runtime environment variables and token handling for frontend Vite source-map upload and backend TypeScript source-map upload without committing secrets.
- [x] 4.4 Run or prepare the frontend source-map upload path with a shared `m365copilot-game@<git-sha>` release and the configured Sentry SaaS organization/project.
- [x] 4.5 Run or prepare the backend source-map upload path with the same shared release and the configured Sentry SaaS organization/project.
- [ ] 4.6 Complete the controlled non-production Sentry smoke verification and record which release, environment, telemetry types, replay state, trace, metric, and source-map checks passed.

## 5. Validation

- [x] 5.1 Run frontend `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 5.2 Run backend `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 5.3 Run applicable Playwright coverage for frontend API/logging behavior or affected full-stack flows.
- [x] 5.4 Run `openspec validate refine-sentry-logging-and-verification --strict`.
- [x] 5.5 Confirm Application Insights remains documented and available as the Azure platform/runtime diagnostics layer after the Sentry refinement.