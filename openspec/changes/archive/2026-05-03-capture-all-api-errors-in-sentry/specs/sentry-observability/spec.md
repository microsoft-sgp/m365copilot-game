## ADDED Requirements

### Requirement: Deployed Sentry configuration enables both runtimes

The system SHALL configure the same Sentry project DSN for the deployed frontend browser bundle and backend Function App so both runtimes can emit Sentry events in shared environments.

#### Scenario: Backend runtime receives Sentry DSN from Terraform

- **GIVEN** Terraform is applied for a shared deployed environment
- **WHEN** the Function App starts
- **THEN** the backend MUST receive a non-empty `SENTRY_DSN` app setting for the configured Sentry project
- **AND** backend Sentry initialization MUST be enabled without manual portal-only configuration

#### Scenario: Frontend bundle is built with Sentry DSN

- **GIVEN** the frontend is built for a shared deployed environment
- **WHEN** the Vite build runs
- **THEN** the build MUST receive a non-empty `VITE_SENTRY_DSN` for the same configured Sentry project
- **AND** the deployed browser bundle MUST initialize Sentry at runtime

#### Scenario: Frontend and backend use matching release metadata

- **GIVEN** a shared deployment builds frontend and backend artifacts
- **WHEN** Sentry events are emitted from either runtime
- **THEN** frontend and backend events MUST include matching release metadata when a release value is supplied for the deployment

## MODIFIED Requirements

### Requirement: Frontend errors and network failures are captured safely

The system SHALL capture frontend Vue runtime errors, unhandled promise rejections, all API failure responses with HTTP status `400` through `599`, browser network failures, browser logs, frontend metrics, and session replay in Sentry without changing the existing API response contract.

#### Scenario: Vue runtime error is captured

- **GIVEN** Sentry is configured in the frontend
- **WHEN** a Vue component or frontend handler throws an unexpected error
- **THEN** Sentry MUST capture the error with frontend service tags, environment metadata, release metadata, and source-map-compatible stack information

#### Scenario: Browser network failure is captured every time initially

- **GIVEN** Sentry is configured in the frontend API layer
- **WHEN** a frontend API request fails with `status: 0` because the browser cannot complete the request
- **THEN** Sentry MUST capture a network-failure event containing the HTTP method, sanitized endpoint path, API host, online/offline state when available, service tags, and release metadata
- **AND** the frontend MUST still return the existing `{ ok: false, status: 0, data: null }` API response shape to callers

#### Scenario: API failure response is captured for every 4xx and 5xx status

- **GIVEN** Sentry is configured in the frontend API layer
- **WHEN** a frontend API request receives any HTTP response with status `400` through `599`
- **THEN** Sentry MUST capture an API failure event containing the HTTP method, sanitized endpoint path, status code, status class, API host, frontend service tags, environment metadata, and release metadata
- **AND** the frontend MUST still return the existing API response shape, response body, status code, and token/cookie side effects to callers

#### Scenario: Expected API responses remain filterable in Sentry

- **GIVEN** Sentry captures a frontend API response with status `400` through `499`
- **WHEN** the event is sent
- **THEN** the event MUST include tags or context that distinguish it from `500` through `599` server failures
- **AND** the event MUST use stable grouping so repeated expected workflow responses such as recovery-required conflicts can be filtered without hiding unexpected server failures

### Requirement: Backend handler failures and operational failures are captured

The system SHALL capture unexpected Azure Functions handler exceptions, local Express adapter handler exceptions, all returned backend HTTP responses with status `400` through `599`, and selected handled operational failures in Sentry while preserving the API's existing response semantics.

#### Scenario: Unexpected Azure Functions handler exception is captured and flushed

- **GIVEN** Sentry is configured in the backend
- **WHEN** an Azure Functions HTTP handler throws an unexpected exception
- **THEN** the backend MUST capture the exception with backend service tags, sanitized request context, environment metadata, and release metadata
- **AND** the backend MUST flush the Sentry event before the invocation completes
- **AND** the backend MUST preserve the existing failure behavior expected by the Azure Functions runtime

#### Scenario: Local Express adapter exception is captured

- **GIVEN** Sentry is configured for local full-stack or Docker execution
- **WHEN** the local Express adapter catches an unexpected handler error
- **THEN** the backend MUST capture the exception with local Express runtime tags and sanitized request context before returning the local adapter's error response

#### Scenario: Returned backend API failure response is captured for every 4xx and 5xx status

- **GIVEN** Sentry is configured in the backend
- **WHEN** an Azure Functions HTTP handler or local Express adapter returns an HTTP response with status `400` through `599`
- **THEN** the backend MUST capture a Sentry event containing the function or route name, HTTP method when available, sanitized request path, status code, status class, runtime, backend service tags, environment metadata, and release metadata
- **AND** the backend MUST preserve the returned status code, JSON body, headers, cookies, and existing response semantics

#### Scenario: Backend 4xx and 5xx response events are distinguishable

- **GIVEN** Sentry captures a returned backend HTTP response with status `400` through `599`
- **WHEN** the event is sent
- **THEN** the event MUST include tags or context that distinguish `400` through `499` client/workflow responses from `500` through `599` server failures
- **AND** the event MUST use stable grouping by runtime, function or route, method, sanitized path, and status code

#### Scenario: ACS Email failure is captured as an operational error

- **GIVEN** Sentry is configured in the backend
- **WHEN** admin OTP or player recovery email delivery returns a non-configured, non-succeeded, or exception result in a shared environment
- **THEN** the backend MUST capture a Sentry event describing the operational failure category, provider status, sanitized recipient domain or classification when safe, latency, environment, and release
- **AND** the backend MUST NOT include OTP values, recovery codes, connection strings, or full recipient addresses
