## Context

The existing Sentry rollout initializes the Vue frontend and backend runtimes, wraps Azure Functions HTTP handlers, captures frontend API failures, captures backend returned failures, supports replay/tracing/metrics configuration, and documents source-map upload. That gives a useful foundation, but two important gaps remain before Sentry can become the dependable production triage surface.

First, ordinary application `4xx` responses are currently captured as Sentry Issues. In this app, many `400`, `401`, `403`, `404`, `409`, and `429` responses are expected workflow outcomes: validation errors, stale tokens, OTP lockouts, duplicate keyword conflicts, player recovery requirements, assignment lifecycle transitions, and admin step-up denials. Those signals are useful for operations, but they should not compete with real breakage in the Issue inbox.

Second, the code has Sentry-aware helper functions, but application logging is not consistently routed through Sentry Logs. Existing backend `context.log` events and frontend swallowed promise paths should become structured, sanitized logs or breadcrumbs without losing the platform logging behavior operators already get from Azure Functions and local development output.

## Goals / Non-Goals

**Goals:**

- Keep Sentry Issues focused on unexpected exceptions, frontend `status: 0` network failures, `5xx` responses, and explicitly selected operational failures.
- Emit ordinary `4xx` workflow responses as structured Sentry Logs and metrics by default, with enough classification to filter by status class, endpoint, workflow code, service, runtime, environment, and release.
- Route existing backend operational logs through a Sentry-aware path while preserving Azure `context.log` output.
- Add frontend logs or breadcrumbs for nonfatal UI failures and swallowed promise paths that are diagnostically useful.
- Apply the same privacy filtering to logs and metrics attributes that error events already receive.
- Complete and document live non-production Sentry ingestion verification, including source-map-resolved frontend and backend stack traces.

**Non-Goals:**

- Remove Application Insights or Azure Functions platform logging.
- Create a separate Sentry project or change the one-project service-tagging model.
- Add Sentry alert rules before live volume and signal quality are known.
- Capture local database migration and seed script console output in Sentry by default.
- Record unmasked session replay data as part of verification.

## Decisions

### Decision 1: Treat Sentry Issues as breakage, Sentry Logs as workflow telemetry

Issue capture should be reserved for events that need triage as application breakage. Default captured Issue categories are:

- frontend Vue/runtime errors and unhandled promise rejections captured by the SDK;
- frontend API `status: 0` network failures;
- frontend and backend `5xx` API responses;
- unexpected backend handler exceptions;
- selected operational failures such as ACS Email provider/configuration failures.

Ordinary `4xx` outcomes should emit Sentry Logs and metrics instead of Issues. This keeps validation/auth/conflict workflows searchable without flooding the Issue stream.

Alternative considered: capture every `400` through `599` as Issues and rely on Sentry filtering. That provides early visibility, but it pushes routine product control flow into the same inbox as outages and forces operators to hide noise after it is already emitted. Client-side classification is more intentional and matches the app's distinction between expected workflow and operational breakage.

```text
API response or runtime event
    │
    ├─ unexpected exception ───────────────▶ Sentry Issue
    ├─ frontend status 0 ──────────────────▶ Sentry Issue
    ├─ 5xx response ───────────────────────▶ Sentry Issue
    ├─ selected operational failure ───────▶ Sentry Issue
    └─ ordinary 4xx/workflow outcome ──────▶ Sentry Log + metric
```

### Decision 2: Add explicit API outcome classification

Frontend and backend Sentry helpers should classify API outcomes before deciding whether to capture an Issue, emit a log, increment a metric, or both. Classification should use only sanitized, low-cardinality attributes:

- service and runtime;
- HTTP method;
- sanitized path without query values;
- status code and status class;
- stable workflow code when present, such as `PLAYER_RECOVERY_REQUIRED` or `ASSIGNMENT_NOT_ACTIVE`;
- function name or route name for backend events.

The classifier should default ordinary `4xx` to logs/metrics and `5xx` plus `status: 0` to Issues. If future operations need a specific `4xx` promoted to an Issue, the implementation can add an explicit allowlist or configuration flag instead of broadening all `4xx` capture.

Alternative considered: hard-code status thresholds directly in API helpers. A classifier is slightly more structure up front, but it makes the policy testable and avoids duplicating frontend/backend behavior.

### Decision 3: Use real Sentry Logs for application logs

The Sentry-aware log helpers should emit via the SDK logging API rather than `captureMessage`, because `captureMessage` creates Issues. The helpers should continue to expose a small local abstraction so the rest of the codebase does not import Sentry directly at every call site.

Backend logging should preserve platform output:

```text
Backend call site
    │
    ▼
logBackendEvent(context, event, level, attributes)
    │
    ├─ Azure Functions context.log/context.error
    │
    └─ Sentry.logger.<level>(event, sanitized attributes)
```

Frontend logging should be used selectively for nonfatal diagnostics such as clipboard failures, auth watcher promise failures, and expected API responses. Broad `console` interception is not the default because it can capture noisy or sensitive browser output; explicit logs are easier to sanitize and test.

Alternative considered: enable `consoleLoggingIntegration` for `log`, `warn`, and `error`. That is useful for apps that already rely on console as their logging interface, but this codebase mostly has explicit domain events. A typed helper gives better privacy and attribute consistency.

### Decision 4: Sanitize logs with the same privacy posture as errors

Log attributes must be scrubbed before leaving the app. Existing event sanitizers already redact sensitive key patterns and email addresses; the same sanitizer should apply to log attributes and metric tags where possible. The backend logging abstraction must avoid sending raw player/admin emails, OTPs, recovery codes, auth tokens, cookies, connection strings, full URLs with query values, or request bodies.

For fields where operational analysis needs identity correlation, the app should use existing hashed identifiers or safe classifications, such as `email_hash`, recipient domain, status class, workflow code, campaign id, pack id, or boolean state flags.

### Decision 5: Keep local scripts console-only by default

Database initialization, migration, and seed scripts should remain console-based unless a future deployment-job observability change brings them into scope. Their output is local/operator workflow telemetry, not runtime application telemetry, and sending it to Sentry by default would require a separate credential and privacy review path.

### Decision 6: Make live Sentry verification an explicit operator task

Unit tests can prove that code calls the Sentry SDK correctly, but they cannot prove that the SaaS project receives events, logs, metrics, traces, replay data, or source maps. This change should complete a controlled non-production verification with a shared release value.

```text
Build frontend/backend with same release
    │
    ├─ upload frontend Vite source maps
    ├─ upload backend TypeScript source maps
    ├─ deploy or run approved non-production stack
    ├─ trigger controlled frontend/backend smoke events
    └─ verify Sentry Issues, Logs, Metrics, Traces, Replay, and source maps
```

Verification should not commit auth tokens or generated secrets. Operators should use environment variables or CI secrets for `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and runtime DSNs.

## Risks / Trade-offs

- [Risk] Ordinary `4xx` logs hide an unexpected client-side regression that used to create an Issue -> Mitigation: emit metrics and structured logs for all ordinary `4xx` outcomes, keep status/path/code filters, and allow explicit promotion for selected operational `4xx` cases.
- [Risk] Sentry Logs volume grows quickly after routing backend `context.log` events -> Mitigation: keep logs structured and domain-level rather than per-loop, use levels intentionally, and tune sampling or log toggles after live volume is known.
- [Risk] Log attributes leak sensitive player/admin data -> Mitigation: reuse sanitization helpers, prefer hashes/classifications, add unit tests for `beforeSendLog` and helper-level redaction.
- [Risk] Replacing `captureMessage` with Sentry Logs reduces visibility for operators who only watch Issues -> Mitigation: update docs and verification steps to check Logs and metrics, and keep true breakage in Issues.
- [Risk] Source-map verification is blocked by missing Sentry auth token or project permissions -> Mitigation: document required token scopes and keep verification as an operator-run task in an approved non-production environment.
- [Risk] Live smoke tests trigger visible user-facing failures -> Mitigation: keep smoke paths operator-controlled, non-user-facing, and limited to non-production or explicitly approved diagnostic environments.

## Migration Plan

1. Update frontend and backend Sentry helpers with explicit API outcome classification, real Sentry Logs support, log sanitization, and metrics for ordinary `4xx` outcomes.
2. Update frontend API helper behavior so `status: 0` and `5xx` still create Issues while ordinary `4xx` emits logs/metrics and preserves the existing `ApiResponse` contract.
3. Update backend returned-response capture so unexpected exceptions and `5xx` responses create Issues while ordinary returned `4xx` responses emit logs/metrics and preserve response semantics.
4. Replace direct backend domain logging call sites with the Sentry-aware logging abstraction where the code already emits operational events.
5. Add frontend logs or breadcrumbs for nonfatal clipboard and swallowed promise paths.
6. Update tests for classification, log sanitization, preserved `context.log`, and live-verification documentation hooks.
7. Run frontend/backend unit tests, type checks, lint, builds, and applicable Playwright coverage.
8. In an approved non-production environment, upload frontend and backend source maps for a shared release, trigger controlled Sentry smoke events, and record verification notes in deployment documentation or the change artifacts.

Rollback strategy: restore prior broad `400` through `599` Issue capture if needed, disable Sentry Logs and metrics through DSN/log configuration, revert call-site logging helper changes, skip source-map upload, and continue to rely on Application Insights for Azure platform diagnostics while the Sentry refinement is rolled back.

## Open Questions

- Should selected operational `4xx` promotion be controlled only in code, or should it also have an environment flag such as `SENTRY_CAPTURE_4XX_MODE=selected|all` for short diagnostic windows?
- Where should verification evidence live after the non-production Sentry smoke test: deployment docs, a change note, or a dedicated operations runbook?
- Should source-map upload be fully automated in CI after manual verification succeeds, or remain an operator-run release step for now?