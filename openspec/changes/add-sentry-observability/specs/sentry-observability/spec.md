## ADDED Requirements

### Requirement: Unified Sentry application observability

The system SHALL use one configured Sentry project as the primary application observability destination for frontend and backend application errors, logs, metrics, traces, session replay, release metadata, and source-map-aware stack traces.

#### Scenario: Frontend and backend events share one project with distinct tags

- **GIVEN** Sentry is configured for a deployed environment
- **WHEN** the frontend browser runtime and backend API capture application telemetry
- **THEN** both surfaces MUST send events to the same Sentry project and MUST tag each event with service, runtime, environment, and release metadata sufficient to distinguish browser, Azure Functions, and local Express sources

#### Scenario: Missing DSN disables Sentry capture

- **GIVEN** a local developer or test runner has not configured a Sentry DSN
- **WHEN** the frontend or backend application starts
- **THEN** Sentry SDK initialization MUST be skipped or disabled without throwing startup errors and without changing existing application behavior

### Requirement: Frontend errors and network failures are captured safely

The system SHALL capture frontend Vue runtime errors, unhandled promise rejections, selected API failures, browser logs, frontend metrics, and session replay in Sentry without changing the existing API response contract.

#### Scenario: Vue runtime error is captured

- **GIVEN** Sentry is configured in the frontend
- **WHEN** a Vue component or frontend handler throws an unexpected error
- **THEN** Sentry MUST capture the error with frontend service tags, environment metadata, release metadata, and source-map-compatible stack information

#### Scenario: Browser network failure is captured every time initially

- **GIVEN** Sentry is configured in the frontend API layer
- **WHEN** a frontend API request fails with `status: 0` because the browser cannot complete the request
- **THEN** Sentry MUST capture a network-failure event containing the HTTP method, sanitized endpoint path, API host, online/offline state when available, service tags, and release metadata, and MUST still return the existing `{ ok: false, status: 0, data: null }` API response shape to callers

#### Scenario: Expected API responses are not captured as errors by default

- **GIVEN** Sentry is configured in the frontend API layer
- **WHEN** an API response returns an expected validation, authentication, authorization, or conflict status such as 400, 401, 403, or 409
- **THEN** the frontend MUST NOT capture the response as a Sentry error unless a specific workflow classifies that response as an operational failure

### Requirement: Backend handler failures and operational failures are captured

The system SHALL capture unexpected Azure Functions handler exceptions, local Express adapter handler exceptions, and selected handled operational failures in Sentry while preserving the API's existing response semantics.

#### Scenario: Unexpected Azure Functions handler exception is captured and flushed

- **GIVEN** Sentry is configured in the backend
- **WHEN** an Azure Functions HTTP handler throws an unexpected exception
- **THEN** the backend MUST capture the exception with backend service tags, sanitized request context, environment metadata, and release metadata, MUST flush the Sentry event before the invocation completes, and MUST preserve the existing failure behavior expected by the Azure Functions runtime

#### Scenario: Local Express adapter exception is captured

- **GIVEN** Sentry is configured for local full-stack or Docker execution
- **WHEN** the local Express adapter catches an unexpected handler error
- **THEN** the backend MUST capture the exception with local Express runtime tags and sanitized request context before returning the local adapter's error response

#### Scenario: ACS Email failure is captured as an operational error

- **GIVEN** Sentry is configured in the backend
- **WHEN** admin OTP or player recovery email delivery returns a non-configured, non-succeeded, or exception result in a shared environment
- **THEN** the backend MUST capture a Sentry event describing the operational failure category, provider status, sanitized recipient domain or classification when safe, latency, environment, and release, and MUST NOT include OTP values, recovery codes, connection strings, or full recipient addresses

### Requirement: Sentry telemetry is privacy filtered by default

The system SHALL scrub sensitive data from Sentry errors, logs, breadcrumbs, traces, metrics attributes, and session replay by default before telemetry leaves the application. The system SHALL require explicit frontend build-time configuration before unmasked session replay can be enabled for approved diagnostic builds.

#### Scenario: Sensitive headers and tokens are removed

- **GIVEN** Sentry prepares to send a frontend or backend event
- **WHEN** the event contains request headers, cookies, authorization values, admin keys, player tokens, JWTs, Sentry auth tokens, SQL or Redis connection strings, ACS connection strings, OTP codes, recovery codes, or request bodies containing player/admin identity fields
- **THEN** the telemetry filter MUST remove or redact those values before the event is sent to Sentry

#### Scenario: Session replay masks sensitive UI content

- **GIVEN** Sentry session replay is enabled in the frontend
- **WHEN** a player or admin uses onboarding, gameplay, admin login, OTP verification, player recovery, admin management, CSV export, or danger-zone workflows
- **THEN** session replay MUST mask text and input values by default, block sensitive media where practical, and MUST NOT record visible OTP values, recovery codes, auth tokens, exported CSV contents, or unmasked player/admin personal data

#### Scenario: Unmasked session replay requires explicit opt-in

- **GIVEN** `VITE_SENTRY_REPLAY_UNMASK` is absent or false during the frontend build
- **WHEN** the frontend initializes Sentry session replay
- **THEN** session replay MUST mask text, mask input values, and block media
- **GIVEN** `VITE_SENTRY_REPLAY_UNMASK` is set to true during an approved diagnostic frontend build
- **WHEN** the frontend initializes Sentry session replay
- **THEN** session replay MAY send unmasked text, input values, and media, and deployment documentation MUST warn operators to review privacy, consent, retention, and Sentry access controls before using that build

### Requirement: Sentry traces, logs, and metrics are explicitly configured

The system SHALL configure Sentry tracing, logs, and application metrics with environment-aware sampling and verification paths.

#### Scenario: Frontend-to-backend tracing uses allowed headers

- **GIVEN** distributed tracing is enabled for frontend API calls
- **WHEN** the browser sends trace propagation headers to the backend API
- **THEN** local and deployed backend CORS configuration MUST allow the required Sentry tracing headers and MUST restrict propagation to configured application API targets

#### Scenario: Sentry metric smoke check is available to operators

- **GIVEN** an operator verifies Sentry metrics in a non-user-facing smoke path
- **WHEN** the verification code emits `Sentry.metrics.count('test_counter', 1)` before triggering a controlled test exception
- **THEN** Sentry MUST receive the metric and associated test error with the configured service, environment, and release metadata

#### Scenario: Application logs use Sentry without leaking secrets

- **GIVEN** Sentry logs are enabled for a shared environment
- **WHEN** frontend or backend code records application logs through the Sentry-aware logging path
- **THEN** logs sent to Sentry MUST include severity, service, runtime, environment, and release metadata and MUST pass through the same privacy filtering rules as error events

### Requirement: Sentry release and source maps support readable incidents

The system SHALL publish release metadata and source maps for frontend and backend builds so Sentry incidents can be traced back to the deployed source version.

#### Scenario: Git SHA release is shared across frontend and backend

- **GIVEN** an operator prepares a deployment without a CI-generated version
- **WHEN** frontend and backend artifacts are built and published
- **THEN** both artifacts MUST use a shared release value based on the current git commit, formatted as `m365copilot-game@<git-sha>` or an equivalent documented git-SHA-based value

#### Scenario: Source maps are uploaded without committing upload secrets

- **GIVEN** an operator configures Sentry source map upload for the SaaS organization and project
- **WHEN** the documented Sentry wizard or equivalent source-map upload command runs
- **THEN** frontend Vite source maps and backend TypeScript source maps MUST be associated with the deployed Sentry release, and Sentry upload tokens MUST remain outside source control, Terraform variables, Terraform state, and public documentation examples

### Requirement: Application Insights remains Azure platform diagnostics

The system SHALL keep Application Insights available for Azure platform/runtime diagnostics while Sentry becomes the primary application observability destination.

#### Scenario: Application Insights is retained during Sentry rollout

- **GIVEN** Terraform is used to provision or update the Azure environment
- **WHEN** Sentry observability settings are added
- **THEN** the deployment MUST retain Application Insights wiring for Azure Functions/App Service host diagnostics, invocation telemetry, platform health, and Azure Portal troubleshooting unless a separate approved change removes it

#### Scenario: Operators can distinguish Sentry and Application Insights responsibilities

- **GIVEN** an operator reads deployment or troubleshooting documentation
- **WHEN** they compare observability tools
- **THEN** the documentation MUST state that Sentry is the primary application observability workspace and Application Insights remains the Azure platform/runtime diagnostic layer