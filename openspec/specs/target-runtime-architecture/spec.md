# target-runtime-architecture

## Purpose

Defines target runtime architecture expectations for TypeScript source, verification gates, reproducible package installation, and repeatable deployment configuration.

## Requirements

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

The system SHALL document and configure the target Azure runtime dependencies through repeatable infrastructure and deployment settings, AND Terraform state for every environment SHALL be held in an Azure Storage remote backend that uses Azure AD authentication, blob versioning, and soft-delete, never in a workstation file.

#### Scenario: Runtime settings are declared

- **GIVEN** the Terraform deployment path is used
- **WHEN** infrastructure is reviewed or planned
- **THEN** Function App settings, Key Vault references, Azure SQL settings, Redis settings, JWT secrets, CORS origins, and Static Web Apps/API integration settings MUST be declared through repeatable configuration rather than hand-created production values

#### Scenario: Verification commands are documented

- **GIVEN** a contributor or operator prepares a change for release
- **WHEN** they read the repository setup or deployment documentation
- **THEN** the documentation MUST identify the required clean install, type-check, lint, format-check, Vitest, and Playwright commands for the target architecture

#### Scenario: Terraform state lives in a remote backend

- **GIVEN** an operator runs `terraform init` for any environment of `infra/terraform/`
- **WHEN** the backend block is read from `providers.tf`
- **THEN** the backend MUST be `azurerm` configured with `use_azuread_auth = true`, the state container MUST be a private blob in an Azure Storage account that has shared-key authentication disabled, blob versioning enabled, and blob soft-delete retention of at least 7 days, and the Storage account name / resource group / container / key MUST be supplied via `-backend-config=backend.config` (partial config) so per-environment values stay out of Terraform source

#### Scenario: Terraform state is never written to workstation disk for shared environments

- **GIVEN** any deployment to `dev`, staging, or production
- **WHEN** an operator runs `terraform plan`, `terraform apply`, or `terraform import`
- **THEN** the resulting state MUST be persisted only to the remote backend, no `terraform.tfstate` or `terraform.tfstate.backup` file MUST remain on the operator's workstation after the command completes (the local `.terraform/` cache is exempt because it does not contain state), and the operator runbook MUST document shredding any pre-migration local state files

#### Scenario: Bootstrap of the state store is documented and reproducible

- **GIVEN** a fresh contributor with `az login` and a target environment
- **WHEN** they follow the Terraform setup documentation
- **THEN** the documentation MUST point to an idempotent bootstrap script (`infra/terraform/bootstrap-state.sh`) that creates the state-store resource group, Storage account (TLS 1.2 minimum, shared-key disabled, versioning + soft-delete on), and `tfstate` container, and grants the operator `Storage Blob Data Contributor` on the account

### Requirement: Player token enforcement is pinned in deployment configuration

The system SHALL set `ENABLE_PLAYER_TOKEN_ENFORCEMENT` explicitly in deployment configuration to `"true"` for every shared environment, and the Terraform input variable backing it SHALL be typed as a boolean with a default of `true` so unset values cannot weaken enforcement.

#### Scenario: Function App receives the explicit setting

- **GIVEN** the Terraform module is applied for `dev`, staging, or production
- **WHEN** the resulting Function App `app_settings` are inspected
- **THEN** the map MUST include `ENABLE_PLAYER_TOKEN_ENFORCEMENT = "true"` (literal lowercase string), sourced from `tostring(var.enable_player_token_enforcement)`

#### Scenario: Variable type prevents accidental string overrides

- **GIVEN** an operator edits `infra/terraform/terraform.tfvars`
- **WHEN** they set `enable_player_token_enforcement = "false"` (a string instead of a boolean)
- **THEN** `terraform plan` MUST fail with a type error before producing a plan, because the variable is declared with `type = bool`

#### Scenario: Documentation discourages disabling

- **GIVEN** a contributor reads [infra/terraform/variables.tf](infra/terraform/variables.tf) or the README
- **WHEN** they look up the `enable_player_token_enforcement` variable
- **THEN** the description MUST state that the value MUST stay `true` in production and explain that setting it to `false` is reserved for emergency rollback only
