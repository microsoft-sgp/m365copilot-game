## 1. Dependencies And Configuration

- [x] 1.1 Add Sentry runtime dependencies to the frontend and backend package manifests and refresh lockfiles with clean installs.
- [x] 1.2 Define frontend Sentry build-time configuration names for DSN, environment, release, traces, logs, metrics, and replay sampling.
- [x] 1.3 Define backend Sentry runtime configuration names for DSN, environment, release, traces, logs, metrics, and flush behavior.
- [x] 1.4 Add Terraform or deployment configuration for backend Sentry app settings while keeping Sentry auth/upload tokens out of Terraform state.
- [x] 1.5 Update CORS and CSP configuration where needed for Sentry ingest, replay, and trace propagation headers.

## 2. Frontend Observability

- [x] 2.1 Create a frontend Sentry initialization helper that configures `@sentry/vue` only when DSN configuration is present.
- [x] 2.2 Wire the Vue bootstrap to initialize Sentry before mounting the app and tag events with `service=frontend`, runtime, environment, and release.
- [x] 2.3 Add frontend privacy filtering for events, breadcrumbs, logs, traces, metrics attributes, and replay masking.
- [x] 2.4 Update the frontend API helper to capture every `status: 0` network failure and backend `5xx` response without changing existing `ApiResponse` behavior.
- [x] 2.5 Ensure expected frontend API responses such as 400, 401, 403, and 409 are not captured as Sentry errors by default.
- [x] 2.6 Add a non-user-facing Sentry smoke path or documented snippet for the metric check `Sentry.metrics.count('test_counter', 1); myUndefinedFunction();`.

## 3. Backend Observability

- [x] 3.1 Create a backend Sentry initialization and sanitization helper that configures `@sentry/node` only when DSN configuration is present.
- [x] 3.2 Add an Azure Functions handler wrapper that captures unexpected exceptions, adds backend/runtime/environment/release tags, flushes events, and preserves current failure behavior.
- [x] 3.3 Apply the handler wrapper consistently across backend HTTP function registrations.
- [x] 3.4 Wire the local Express adapter catch path to capture unexpected handler errors with `runtime=local-express` tags when Sentry is configured.
- [x] 3.5 Capture ACS Email non-configured, non-succeeded, and exception results as sanitized operational Sentry events in shared environments.
- [x] 3.6 Add backend Sentry-aware logging, metric, and tracing configuration consistent with the design sampling controls.

## 4. Privacy And Tests

- [x] 4.1 Add co-located frontend Vitest tests for Sentry initialization gating, API failure classification, and frontend event sanitization.
- [x] 4.2 Add co-located backend Vitest tests for Sentry initialization gating, handler wrapper capture/flush behavior, and backend event sanitization.
- [x] 4.3 Add backend Vitest coverage proving ACS Email failures are captured without OTPs, recovery codes, connection strings, or full recipient addresses.
- [x] 4.4 Add frontend coverage or configuration tests proving session replay masks text/input values and blocks sensitive content by default.
- [x] 4.5 Add trace-header/CORS coverage or verification notes for `sentry-trace` and `baggage` propagation.

## 5. Release Metadata And Source Maps

- [x] 5.1 Configure frontend release metadata to use `m365copilot-game@<git-sha>` or the documented equivalent git-SHA-based value.
- [x] 5.2 Configure backend release metadata to use the same deployment release value as the frontend.
- [x] 5.3 Enable frontend production source maps and Sentry upload integration for Vite builds.
- [x] 5.4 Ensure backend TypeScript source maps are uploaded or documented for upload against the same Sentry release.
- [x] 5.5 Run or document the Sentry source map wizard command `npx @sentry/wizard@latest -i sourcemaps --saas --org voyager163 --project javascript-vue` and review generated changes before committing.

## 6. Documentation And Operations

- [x] 6.1 Update deployment documentation with Sentry DSN, environment, release, sampling, logs, metrics, replay, tracing, and source map upload steps.
- [x] 6.2 Document that Sentry is the primary application observability workspace while Application Insights remains Azure platform/runtime diagnostics.
- [x] 6.3 Document rollback steps for disabling Sentry capture, replay, tracing, logs, metrics, and source map upload without removing Application Insights.
- [x] 6.4 Document secret hygiene for `SENTRY_AUTH_TOKEN` and any source map upload credentials, including keeping them out of Terraform state and source control.

## 7. Verification

- [x] 7.1 Run frontend `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 7.2 Run backend `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 7.3 Run applicable Playwright coverage after Sentry frontend changes.
- [ ] 7.4 Verify a controlled Sentry frontend error, backend error, log, metric, trace, and replay event in a non-production or approved test environment.
- [ ] 7.5 Verify Sentry source maps resolve stack traces for both frontend and backend events.
- [x] 7.6 Confirm Application Insights remains wired for Azure Functions/App Service platform diagnostics after Sentry configuration is added.