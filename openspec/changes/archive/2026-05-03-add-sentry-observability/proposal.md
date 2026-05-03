## Why

The app currently relies on Azure Application Insights for Azure-hosting diagnostics, but it does not have unified application-level visibility across browser errors, backend handler failures, logs, metrics, traces, releases, source maps, and session replay. Adding Sentry gives operators one application observability workspace for frontend and backend incidents while retaining Application Insights for Azure platform/runtime diagnostics.

## What Changes

- Add Sentry as the primary application observability layer for the Vue frontend, Azure Functions backend, and local Express backend adapter.
- Capture application errors, selected handled operational failures, logs, application metrics, session replay, and distributed traces in one Sentry project using service/environment/release tags.
- Add privacy filtering so Sentry events do not include player/admin tokens, OTP or recovery codes, cookies, authorization headers, connection strings, request bodies with personal data, or other secrets.
- Add source map and release metadata support for frontend Vite builds and backend TypeScript output, including the Sentry source map wizard path for the configured Sentry SaaS project.
- Keep Application Insights in place for Azure Functions/App Service host diagnostics, invocation/runtime telemetry, and Azure Portal troubleshooting rather than treating Sentry as a platform telemetry replacement.
- Document configuration, verification, and rollback steps for Sentry DSN, release, environment, tracing, replay, metrics, logs, and source map upload.
- Rollback plan: unset Sentry DSN/build variables and Sentry auth-token deployment secrets, disable replay/tracing/log/metric capture via settings, redeploy without source map upload, and keep Application Insights available for platform diagnostics while reverting Sentry SDK initialization if needed.

## Capabilities

### New Capabilities

- `sentry-observability`: Defines application-level Sentry monitoring for frontend and backend errors, logs, metrics, traces, session replay, privacy filtering, release/source-map metadata, verification, and rollback.

### Modified Capabilities

- `target-runtime-architecture`: Extend repeatable deployment configuration and operator verification requirements to include Sentry runtime/build settings, source map upload inputs, and the intentional boundary between Sentry application monitoring and Application Insights platform monitoring.

## Impact

- Affected code: frontend app bootstrap, frontend API helper, backend Azure Functions handlers, backend local Express adapter, shared observability helpers, and tests for filtering/capture behavior.
- Affected dependencies: add Sentry JavaScript SDK packages for Vue/browser and Node/Azure Functions, plus source-map upload tooling or wizard-generated build configuration.
- Affected infrastructure and deployment: Terraform app settings, frontend build variables, deployment documentation, Sentry auth-token handling outside Terraform state/source control, CORS headers for distributed tracing, and Content Security Policy review for Sentry ingest/replay.
- Affected operations: one Sentry project receives frontend/backend application events; Application Insights remains the Azure runtime/platform diagnostic layer.
- Affected teams: frontend, backend, DevOps/operators, security/privacy reviewers, and event administrators who triage production incidents.