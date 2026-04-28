## ADDED Requirements

### Requirement: Strict TypeScript runtime source

The system SHALL use strict TypeScript for Azure Functions backend source and shared frontend logic that participates in API, auth, cache, persistence, or game-domain behavior.

#### Scenario: Backend source is type checked

- **GIVEN** backend source code has been changed
- **WHEN** the backend type-check command is run
- **THEN** the command MUST validate the Azure Functions TypeScript source under strict compiler settings without emitting runtime artifacts into source directories

#### Scenario: Shared frontend logic is type checked

- **GIVEN** frontend source code that handles API calls, auth state, storage, verification, pack generation, or other game-domain behavior has been changed
- **WHEN** the frontend type-check command is run
- **THEN** the command MUST validate the TypeScript-aware frontend source without requiring browser-only globals during pure logic checks

#### Scenario: JavaScript-only backend implementation is no longer accepted

- **GIVEN** a backend handler or shared backend helper remains as JavaScript-only source after the migration is complete
- **WHEN** the implementation is reviewed against the target architecture
- **THEN** the work MUST be considered incomplete unless the file is explicitly documented as generated compatibility output and excluded from source-of-truth editing

### Requirement: Linting and formatting gates

The system SHALL provide ESLint and Prettier configuration for backend and frontend source, and SHALL expose package scripts that can validate style without modifying files.

#### Scenario: Lint command validates source

- **GIVEN** backend or frontend source has changed
- **WHEN** the relevant lint command is run
- **THEN** ESLint MUST analyze the changed project using the repository configuration and fail on rule violations that would block maintainable TypeScript or Vue code

#### Scenario: Format check validates source

- **GIVEN** source, tests, OpenSpec artifacts, or documentation has changed
- **WHEN** the relevant format-check command is run
- **THEN** Prettier MUST report whether files match repository formatting without rewriting files during the check command

### Requirement: Unit and end-to-end test gates

The system SHALL preserve co-located Vitest unit tests for backend/frontend logic and add Playwright end-to-end tests for browser-visible critical flows.

#### Scenario: Vitest remains co-located

- **GIVEN** new backend or frontend logic is added
- **WHEN** unit tests are created for that logic
- **THEN** the tests MUST use Vitest and be co-located as `*.test.ts`, `*.test.js`, or Vue test files next to the code under test

#### Scenario: Core player flow has e2e coverage

- **GIVEN** the app is running against a test backend and database
- **WHEN** the Playwright smoke suite runs the player flow
- **THEN** it MUST cover onboarding, assigned pack startup, tile verification, local/session persistence, and leaderboard or activity visibility at a smoke-test level

#### Scenario: Core admin flow has e2e coverage

- **GIVEN** the app is running with test admin OTP delivery or a deterministic test OTP provider
- **WHEN** the Playwright smoke suite runs the admin flow
- **THEN** it MUST cover admin OTP login, authenticated dashboard access, credentialed API requests, logout, and rejection after logout or session expiry

### Requirement: Reproducible package installation

The system SHALL keep package manifests and lockfiles synchronized so clean dependency installation succeeds for backend and frontend projects.

#### Scenario: Backend clean install succeeds

- **GIVEN** a developer or CI runner has Node.js that satisfies the backend engine requirement
- **WHEN** `npm ci` is run in the backend project
- **THEN** dependencies MUST install from `package-lock.json` without requiring lockfile mutation

#### Scenario: Frontend clean install succeeds

- **GIVEN** a developer or CI runner has Node.js that satisfies the frontend tooling requirements
- **WHEN** `npm ci` is run in the frontend project
- **THEN** dependencies MUST install from `package-lock.json` without requiring lockfile mutation

### Requirement: Target deployment configuration

The system SHALL document and configure the target Azure runtime dependencies through repeatable infrastructure and deployment settings.

#### Scenario: Runtime settings are declared

- **GIVEN** the Terraform deployment path is used
- **WHEN** infrastructure is reviewed or planned
- **THEN** Function App settings, Key Vault references, Azure SQL settings, Redis settings, JWT secrets, CORS origins, and Static Web Apps/API integration settings MUST be declared through repeatable configuration rather than hand-created production values

#### Scenario: Verification commands are documented

- **GIVEN** a contributor or operator prepares a change for release
- **WHEN** they read the repository setup or deployment documentation
- **THEN** the documentation MUST identify the required clean install, type-check, lint, format-check, Vitest, and Playwright commands for the target architecture
