## ADDED Requirements

### Requirement: Controlled Sentry live verification is completed
The system SHALL provide and complete an operator-controlled non-production verification path proving Sentry receives frontend and backend Issues, Logs, metrics, traces, replay data, and source-map-resolved stack traces before Sentry is treated as production-ready application observability.

#### Scenario: Controlled live smoke emits expected Sentry telemetry
- **GIVEN** a non-production or explicitly approved diagnostic environment is configured with frontend and backend Sentry DSNs, matching release metadata, tracing, replay, logs, and metrics enabled
- **WHEN** an operator runs the controlled Sentry verification path
- **THEN** Sentry MUST receive a frontend Issue, backend Issue, structured frontend or backend Log, metric event, frontend-to-backend trace, and masked session replay associated with the configured environment and release
- **AND** the verification path MUST NOT expose OTP values, recovery codes, auth tokens, cookies, connection strings, exported CSV contents, or unmasked player/admin personal data

#### Scenario: Live verification evidence is recorded
- **GIVEN** an operator completes the controlled Sentry verification path
- **WHEN** frontend and backend telemetry are visible in Sentry
- **THEN** the operator MUST record which release, environment, telemetry types, and source-map checks passed in deployment documentation, operations notes, or the change verification record
- **AND** the record MUST NOT include Sentry auth tokens, DSNs containing project secrets beyond approved placeholders, OTP values, recovery codes, cookies, player tokens, or personal request payloads

## MODIFIED Requirements

### Requirement: Frontend errors and network failures are captured safely
The system SHALL capture frontend Vue runtime errors, unhandled promise rejections, browser network failures with `status: 0`, backend `5xx` API responses, browser logs, frontend metrics, and session replay in Sentry without changing the existing API response contract. Ordinary frontend API responses with HTTP status `400` through `499` SHALL be emitted as structured Sentry Logs and metrics by default rather than Sentry Issues, unless a specific response class is explicitly promoted as operationally significant.

#### Scenario: Vue runtime error is captured
- **GIVEN** Sentry is configured in the frontend
- **WHEN** a Vue component or frontend handler throws an unexpected error
- **THEN** Sentry MUST capture the error as an Issue with frontend service tags, environment metadata, release metadata, and source-map-compatible stack information

#### Scenario: Browser network failure is captured every time initially
- **GIVEN** Sentry is configured in the frontend API layer
- **WHEN** a frontend API request fails with `status: 0` because the browser cannot complete the request
- **THEN** Sentry MUST capture a network-failure Issue containing the HTTP method, sanitized endpoint path, API host, online/offline state when available, service tags, and release metadata
- **AND** the frontend MUST still return the existing `{ ok: false, status: 0, data: null }` API response shape to callers

#### Scenario: Frontend backend-service failure response is captured as an Issue
- **GIVEN** Sentry is configured in the frontend API layer
- **WHEN** a frontend API request receives an HTTP response with status `500` through `599`
- **THEN** Sentry MUST capture an API server-failure Issue containing the HTTP method, sanitized endpoint path, status code, status class, API host, frontend service tags, environment metadata, and release metadata
- **AND** the frontend MUST still return the existing API response shape, response body, status code, and token/cookie side effects to callers

#### Scenario: Ordinary frontend API client response is logged without creating an Issue
- **GIVEN** Sentry Logs are enabled in the frontend API layer
- **WHEN** a frontend API request receives an expected or ordinary HTTP response with status `400` through `499`
- **THEN** the frontend MUST emit a structured Sentry Log and metric containing the HTTP method, sanitized endpoint path, status code, status class, API host, frontend service tags, environment metadata, and release metadata
- **AND** the frontend MUST NOT create a Sentry Issue for that response by default
- **AND** the frontend MUST still return the existing API response shape, response body, status code, and token/cookie side effects to callers

#### Scenario: Expected frontend API responses remain searchable in Sentry Logs
- **GIVEN** Sentry logs a frontend API response with status `400` through `499`
- **WHEN** the log is sent
- **THEN** the log MUST include attributes or tags that distinguish it from `500` through `599` server failures
- **AND** the log MUST use stable, low-cardinality attributes so repeated expected workflow responses such as recovery-required conflicts can be filtered without hiding unexpected server failures

### Requirement: Backend handler failures and operational failures are captured
The system SHALL capture unexpected Azure Functions handler exceptions, local Express adapter handler exceptions, returned backend HTTP responses with status `500` through `599`, and selected handled operational failures in Sentry while preserving the API's existing response semantics. Ordinary returned backend HTTP responses with status `400` through `499` SHALL be emitted as structured Sentry Logs and metrics by default rather than Sentry Issues, unless a specific response class is explicitly promoted as operationally significant.

#### Scenario: Unexpected Azure Functions handler exception is captured and flushed
- **GIVEN** Sentry is configured in the backend
- **WHEN** an Azure Functions HTTP handler throws an unexpected exception
- **THEN** the backend MUST capture the exception as an Issue with backend service tags, sanitized request context, environment metadata, and release metadata
- **AND** the backend MUST flush the Sentry event before the invocation completes
- **AND** the backend MUST preserve the existing failure behavior expected by the Azure Functions runtime

#### Scenario: Local Express adapter exception is captured
- **GIVEN** Sentry is configured for local full-stack or Docker execution
- **WHEN** the local Express adapter catches an unexpected handler error
- **THEN** the backend MUST capture the exception as an Issue with local Express runtime tags and sanitized request context before returning the local adapter's error response

#### Scenario: Returned backend server-failure response is captured as an Issue
- **GIVEN** Sentry is configured in the backend
- **WHEN** an Azure Functions HTTP handler or local Express adapter returns an HTTP response with status `500` through `599`
- **THEN** the backend MUST capture a Sentry Issue containing the function or route name, HTTP method when available, sanitized request path, status code, status class, runtime, backend service tags, environment metadata, and release metadata
- **AND** the backend MUST preserve the returned status code, JSON body, headers, cookies, and existing response semantics

#### Scenario: Ordinary returned backend client response is logged without creating an Issue
- **GIVEN** Sentry Logs are enabled in the backend
- **WHEN** an Azure Functions HTTP handler or local Express adapter returns an expected or ordinary HTTP response with status `400` through `499`
- **THEN** the backend MUST emit a structured Sentry Log and metric containing the function or route name, HTTP method when available, sanitized request path, status code, status class, runtime, backend service tags, environment metadata, and release metadata
- **AND** the backend MUST NOT create a Sentry Issue for that returned response by default
- **AND** the backend MUST preserve the returned status code, JSON body, headers, cookies, and existing response semantics

#### Scenario: Backend response telemetry is distinguishable
- **GIVEN** Sentry records backend response telemetry for status `400` through `599`
- **WHEN** the telemetry is sent
- **THEN** the telemetry MUST include tags or attributes that distinguish `400` through `499` client/workflow responses from `500` through `599` server failures
- **AND** the telemetry MUST use stable grouping or low-cardinality attributes by runtime, function or route, method, sanitized path, status code, and response class

#### Scenario: ACS Email failure is captured as an operational error
- **GIVEN** Sentry is configured in the backend
- **WHEN** admin OTP or player recovery email delivery returns a non-configured, non-succeeded, or exception result in a shared environment
- **THEN** the backend MUST capture a Sentry Issue describing the operational failure category, provider status, sanitized recipient domain or classification when safe, latency, environment, and release, and MUST NOT include OTP values, recovery codes, connection strings, or full recipient addresses

### Requirement: Sentry telemetry is privacy filtered by default
The system SHALL scrub sensitive data from Sentry errors, logs, breadcrumbs, traces, metrics attributes, and session replay by default before telemetry leaves the application. The system SHALL require explicit frontend build-time configuration before unmasked session replay can be enabled for approved diagnostic builds.

#### Scenario: Sensitive headers and tokens are removed
- **GIVEN** Sentry prepares to send a frontend or backend event
- **WHEN** the event contains request headers, cookies, authorization values, admin keys, player tokens, JWTs, Sentry auth tokens, SQL or Redis connection strings, ACS connection strings, OTP codes, recovery codes, or request bodies containing player/admin identity fields
- **THEN** the telemetry filter MUST remove or redact those values before the event is sent to Sentry

#### Scenario: Sensitive log attributes are removed
- **GIVEN** Sentry prepares to send a frontend or backend log
- **WHEN** the log contains attributes, message parameters, request context, response context, cache details, or workflow details with authorization values, cookies, tokens, JWTs, Sentry auth tokens, SQL or Redis connection strings, ACS connection strings, OTP codes, recovery codes, raw player/admin emails, personal names, or request bodies containing player/admin identity fields
- **THEN** the log filter MUST remove, redact, hash, or safely classify those values before the log is sent to Sentry
- **AND** the log MUST retain enough low-cardinality operational attributes to support triage without exposing sensitive values

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
The system SHALL configure Sentry tracing, real Sentry Logs, and application metrics with environment-aware sampling, privacy filtering, and verification paths.

#### Scenario: Frontend-to-backend tracing uses allowed headers
- **GIVEN** distributed tracing is enabled for frontend API calls
- **WHEN** the browser sends trace propagation headers to the backend API
- **THEN** local and deployed backend CORS configuration MUST allow the required Sentry tracing headers and MUST restrict propagation to configured application API targets

#### Scenario: Sentry metric smoke check is available to operators
- **GIVEN** an operator verifies Sentry metrics in a non-user-facing smoke path
- **WHEN** the verification code emits `Sentry.metrics.count('test_counter', 1)` before triggering a controlled test exception
- **THEN** Sentry MUST receive the metric and associated test error with the configured service, environment, and release metadata

#### Scenario: Application logs use Sentry Logs without leaking secrets
- **GIVEN** Sentry Logs are enabled for a shared environment
- **WHEN** frontend or backend code records application logs through the Sentry-aware logging path
- **THEN** logs sent to Sentry MUST be emitted as Sentry Logs rather than Sentry Issues
- **AND** logs sent to Sentry MUST include severity, service, runtime, environment, release metadata, and sanitized structured attributes
- **AND** logs sent to Sentry MUST pass through the same privacy filtering rules as error events

#### Scenario: Backend application logs preserve platform logging
- **GIVEN** backend code records an application log from an Azure Functions invocation
- **WHEN** Sentry Logs are enabled
- **THEN** the backend MUST preserve the existing Azure `context.log` or `context.error` output expected by platform diagnostics
- **AND** the backend MUST also emit the sanitized log to Sentry Logs when Sentry is configured

#### Scenario: Ordinary API client responses emit metrics
- **GIVEN** Sentry metrics are enabled for a shared environment
- **WHEN** frontend or backend code records an ordinary `400` through `499` API response as a Sentry Log
- **THEN** the system MUST also emit a low-cardinality metric for the response class, service, runtime, method, sanitized route or endpoint, status code, and workflow code when safe

### Requirement: Sentry release and source maps support readable incidents
The system SHALL publish release metadata and source maps for frontend and backend builds so Sentry incidents can be traced back to the deployed source version, and SHALL verify source-map resolution in a controlled non-production Sentry environment.

#### Scenario: Git SHA release is shared across frontend and backend
- **GIVEN** an operator prepares a deployment without a CI-generated version
- **WHEN** frontend and backend artifacts are built and published
- **THEN** both artifacts MUST use a shared release value based on the current git commit, formatted as `m365copilot-game@<git-sha>` or an equivalent documented git-SHA-based value

#### Scenario: Source maps are uploaded without committing upload secrets
- **GIVEN** an operator configures Sentry source map upload for the SaaS organization and project
- **WHEN** the documented Sentry wizard or equivalent source-map upload command runs
- **THEN** frontend Vite source maps and backend TypeScript source maps MUST be associated with the deployed Sentry release, and Sentry upload tokens MUST remain outside source control, Terraform variables, Terraform state, and public documentation examples

#### Scenario: Source-map resolution is verified for frontend and backend
- **GIVEN** frontend and backend source maps have been uploaded for a shared non-production Sentry release
- **WHEN** controlled frontend and backend test errors are captured for that release
- **THEN** Sentry MUST show stack traces resolved to original frontend Vue or TypeScript source and backend TypeScript source rather than only bundled or compiled JavaScript output
- **AND** the verification MUST be completed before the source-map setup is considered production-ready