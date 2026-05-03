## Context

The current deployment provisions Application Insights and wires it to the Azure Function App and frontend App Service. That gives Azure-native platform visibility, but the application code does not yet initialize a browser or backend application observability SDK. Vue runtime failures, browser network failures, handled provider errors, source-map-aware release triage, session replay, and cross-stack application traces are therefore not unified in one incident workspace.

The chosen target is one Sentry SaaS project for both frontend and backend application observability. Events must be separated with tags such as `service`, `runtime`, `environment`, and `release`. Application Insights remains in place for Azure Functions/App Service host diagnostics, invocation telemetry, platform health, and Azure Portal troubleshooting.

## Goals / Non-Goals

**Goals:**

- Initialize Sentry for the Vue frontend, Azure Functions backend, and local Express backend adapter when Sentry DSN configuration is present.
- Capture frontend and backend application errors, logs, application metrics, session replay, and traces with privacy-safe filtering.
- Capture every frontend `status: 0` network failure initially, because those failures usually indicate API reachability, CORS, TLS, deployment, offline, or browser-blocking problems.
- Capture unexpected backend handler exceptions and selected handled operational failures, including ACS Email send failures, without leaking OTPs, recovery codes, tokens, cookies, connection strings, or personal request bodies.
- Stamp frontend and backend events with a shared git-SHA-based release identifier and upload source maps for readable stack traces.
- Document Sentry configuration, verification, source map upload, privacy settings, and rollback steps while retaining Application Insights as the Azure platform diagnostic layer.

**Non-Goals:**

- Remove Application Insights or Azure-native diagnostics from Terraform in this change.
- Create a second Sentry project for backend events.
- Add a full CI/CD release pipeline solely for Sentry source map upload.
- Record unmasked session replay data from player, admin, OTP, or CSV-export workflows.
- Treat expected validation/auth/conflict responses as Sentry errors by default.

## Decisions

### Decision 1: Use one Sentry project with service tags

All frontend and backend events should be sent to the configured Sentry SaaS project, using tags to distinguish surfaces:

```text
service: frontend | backend
runtime: browser | azure-functions | local-express
environment: dev | staging | production
release: m365copilot-game@<git-sha>
```

Rationale: one project gives event operators a single incident inbox, while tags preserve filtering. Separate projects were considered, but would split traces, releases, and incident triage for a small app with one deployment boundary.

### Decision 2: Initialize frontend Sentry at Vue bootstrap

The frontend should initialize `@sentry/vue` from the app bootstrap before mounting Vue. Configuration should come from Vite build-time variables such as `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE`, and sampling flags. If the DSN is absent, the frontend should skip initialization so local tests and development stay quiet by default.

Frontend capture should include Vue runtime errors, unhandled promise rejections, browser logs when enabled, metrics, session replay, frontend spans, and explicit API helper capture for `status: 0` network failures and `5xx` API responses. The API helper should not capture ordinary `400`, `401`, `403`, or `409` responses unless a later requirement classifies a specific response as operationally important.

### Decision 3: Centralize backend Sentry in a wrapper/helper

The backend should add a small Sentry helper that initializes `@sentry/node` once, wraps Azure Functions HTTP handlers, and provides explicit capture helpers for handled operational failures. Because Azure Functions invocations can end quickly, wrapper capture paths should flush Sentry before rethrowing or returning a handled failure response when an event must be delivered.

The local Express adapter should use the same backend Sentry helper in its top-level catch path, because Docker/full-stack testing uses that adapter instead of the Azure Functions host.

Backend handler error flow:

```text
HTTP request
    │
    ▼
Sentry-wrapped Azure Function handler
    │
    ├─ success / expected response ───────────────▶ return response
    │
    └─ unexpected throw
          │
          ▼
      sanitize scope + set tags
          │
          ▼
      captureException + flush
          │
          ▼
      rethrow to preserve current Functions failure behavior
```

### Decision 4: Capture handled operational failures intentionally

Not every handled error should become a Sentry issue. Handled failures should be captured only when they represent operational breakage rather than expected user behavior. Initial captured handled categories should include ACS Email send failures, unresolved provider configuration in shared environments, frontend network failures, and backend `5xx` responses.

Examples to avoid as Sentry errors: invalid form input, stale token refresh that succeeds, duplicate keyword conflicts, unauthorized admin access with expected login recovery, and normal player recovery conflicts.

### Decision 5: Default to privacy-preserving telemetry

Sentry `sendDefaultPii` should stay false. `beforeSend`, breadcrumb filtering, request normalization, and replay masking should scrub or omit sensitive values by default. Session replay should start masked and sampled, with full replay capture on error preferred over broad always-on recording. Operators can build an explicitly unmasked diagnostic frontend by setting `VITE_SENTRY_REPLAY_UNMASK=true`, but that build should only be used after privacy, consent, retention, and Sentry access-control review.

Frontend event flow:

```text
Vue/API/browser event
    │
    ▼
Sentry SDK integration
    │
    ▼
beforeSend / breadcrumb filters
    │
    ├─ drop expected/noisy event
    │
    └─ scrub secrets + personal request data
          │
          ▼
      send to Sentry project
```

### Decision 6: Use git SHA releases and Sentry source maps

Operators should use a git-SHA-based release name today:

```text
m365copilot-game@<short-or-full-git-sha>
```

This release value should be shared by frontend and backend deployment. Frontend builds should upload Vite source maps and backend builds should upload TypeScript output source maps using Sentry tooling. The remembered source map wizard command for the configured project is:

```bash
npx @sentry/wizard@latest -i sourcemaps --saas --org voyager163 --project javascript-vue
```

The Sentry auth token required for upload must not be committed, stored in Terraform variables/state, or printed in deployment docs.

### Decision 7: Keep Application Insights as platform telemetry

Application Insights should remain wired through Terraform and Function host configuration. Sentry becomes the primary application observability platform, but it does not replace Azure Portal-native Function host diagnostics, invocation telemetry, platform health, or App Service troubleshooting in this change.

### Decision 8: Treat tracing and replay as controlled rollout surfaces

Distributed tracing can add headers such as `sentry-trace` and `baggage`; local and Azure CORS settings must allow those headers before frontend-to-backend propagation is enabled. Session replay must be enabled with privacy masking by default and explicit sampling settings. CSP should be reviewed so Sentry ingest/replay endpoints are allowed only as narrowly as practical.

## Risks / Trade-offs

- [Risk] Sentry events leak player emails, admin emails, OTPs, cookies, tokens, or connection strings -> Mitigation: keep `sendDefaultPii` false, strip headers/bodies, mask replay, and add unit tests for sanitization helpers.
- [Risk] Session replay conflicts with privacy expectations for admin and player workflows -> Mitigation: mask all text and inputs by default, block media, sample baseline sessions at a low rate, capture replays on error for diagnosis, and require an explicit build-time flag plus documentation warning before unmasked replay is used.
- [Risk] `status: 0` network failures are noisy during flaky networks -> Mitigation: capture all initially for rollout signal, fingerprint by endpoint/host, and tune sampling or Sentry inbound filters after observing volume.
- [Risk] Distributed tracing headers break CORS -> Mitigation: update allowed headers before enabling browser propagation and cover the header path in tests or deployment verification.
- [Risk] Source map upload token leaks through Terraform state or docs -> Mitigation: keep `SENTRY_AUTH_TOKEN` in operator shell/CI secret storage only and document placeholder-only examples.
- [Risk] Application Insights and Sentry duplicate some backend errors -> Mitigation: define Sentry as app triage and Application Insights as platform diagnostics; avoid building duplicate alert rules until Sentry signal is validated.
- [Risk] Azure Functions can exit before Sentry events send -> Mitigation: explicitly flush captured backend events in wrappers for thrown errors and critical handled failures.

## Migration Plan

1. Add Sentry frontend/backend dependencies and initialization helpers gated by DSN presence.
2. Add privacy filtering helpers and unit tests for event scrubbing, sensitive header removal, replay masking assumptions, and expected-error classification.
3. Wrap backend Azure Functions HTTP handlers and the local Express adapter error path with Sentry capture/flush behavior.
4. Add frontend API helper capture for `status: 0` failures and `5xx` responses while preserving existing `ApiResponse` contracts.
5. Add logs, metrics, tracing, and session replay configuration with conservative sampling defaults; include the metric smoke check `Sentry.metrics.count('test_counter', 1); myUndefinedFunction();` only in an operator-controlled verification path, not user-facing production UI.
6. Add Terraform/application deployment settings for Sentry DSN, environment, release, and sampling flags without placing Sentry auth tokens in Terraform state.
7. Configure source-map support for frontend Vite output and backend TypeScript output, using the Sentry wizard/tooling command for the configured SaaS project.
8. Update deployment docs to explain configuration, source map upload, verification, App Insights/Sentry boundary, and rollback.
9. Verify with unit tests, type checks, lint, frontend/backend builds, Sentry smoke capture, and existing Playwright coverage.

Rollback strategy: remove or unset Sentry DSN/build settings, set sampling to zero or disable replay/tracing/log/metric capture, skip source map upload, redeploy, and rely on the existing Application Insights platform telemetry while reverting Sentry SDK initialization if package removal is needed.

## Open Questions

- What exact baseline session replay sampling rate should the first shared environment use: `0.01`, `0.05`, or disabled except on error?
- Where will operators store `SENTRY_AUTH_TOKEN` before a formal CI secret store exists?
- Should Sentry alerts be created in the same implementation change, or after the first production event volume is known?