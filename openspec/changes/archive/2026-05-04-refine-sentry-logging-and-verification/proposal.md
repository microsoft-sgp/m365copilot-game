## Why

Sentry is wired for the core frontend and backend error paths, but current behavior still treats ordinary `4xx` workflow responses as Sentry Issues and leaves several application logging paths outside Sentry Logs. This change separates "broken" signals from "expected workflow" telemetry and closes the remaining live-ingestion and source-map verification gaps before relying on Sentry for production triage.

## What Changes

- Reclassify Sentry issue capture so unexpected exceptions, frontend `status: 0` network failures, backend/frontend `5xx` responses, and selected operational failures remain Issues, while ordinary `400`, `401`, `403`, `404`, `409`, and `429` responses become structured logs and metrics by default.
- Replace existing Sentry-aware log helpers that use `captureMessage` with real Sentry Logs via the SDK logging API, including privacy filtering for log attributes.
- Add a backend application logging path that preserves Azure `context.log` behavior while emitting sanitized Sentry Logs for OTP, player recovery, cache, pack assignment, local adapter, and operational telemetry.
- Add frontend logging or breadcrumbs for nonfatal UI and promise paths such as clipboard copy failures, swallowed auth watcher errors, and expected API workflow outcomes.
- Add tests proving ordinary `4xx` responses no longer create Sentry Issues by default, `status: 0` and `5xx` still create Issues, logs are sanitized, and existing platform logging behavior is preserved.
- Complete live non-production Sentry verification for frontend error, backend error, log, metric, trace, replay, and source-map-resolved stack traces.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `sentry-observability`: Change telemetry classification requirements so ordinary application `4xx` responses are captured as structured logs and metrics rather than Sentry Issues by default, require real Sentry Logs for application logging paths, and require completed live Sentry ingestion plus frontend/backend source-map verification.

## Impact

- Affected code: frontend Sentry helper, frontend API helper, selected frontend UI/composable nonfatal catch paths, backend Sentry helper, backend Azure Functions logging call sites, local Express adapter, and Sentry-focused Vitest coverage.
- Affected operations: non-production Sentry smoke verification, release/source-map upload workflow, Sentry project issue/log/trace/replay validation, and deployment documentation for verification evidence.
- Affected teams: frontend maintainers, backend/API maintainers, operations/on-call owners, and release/deployment operators who manage Sentry credentials and source-map uploads.
- Rollback plan: restore prior API failure classification to capture every `400` through `599` response as an Issue if needed, disable Sentry Logs by setting log toggles off or removing the Sentry DSN, skip live smoke/source-map upload steps, and continue using Application Insights for Azure platform diagnostics while Sentry behavior is reverted.