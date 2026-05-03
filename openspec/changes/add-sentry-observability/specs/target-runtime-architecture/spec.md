## MODIFIED Requirements

### Requirement: Target deployment configuration

The system SHALL document and configure the target Azure runtime dependencies through repeatable infrastructure and deployment settings, including Sentry application observability settings and the retained Application Insights platform diagnostic boundary, AND Terraform state for every environment SHALL be held in an Azure Storage remote backend that uses Azure AD authentication, blob versioning, and soft-delete, never in a workstation file.

#### Scenario: Runtime settings are declared

- **GIVEN** the Terraform deployment path is used
- **WHEN** infrastructure is reviewed or planned
- **THEN** Function App settings, Key Vault references, Azure SQL settings, Redis settings, JWT secrets, CORS origins, Sentry backend settings, Application Insights platform diagnostics wiring, and Static Web Apps/API integration settings MUST be declared through repeatable configuration rather than hand-created production values

#### Scenario: Frontend Sentry build settings are documented

- **GIVEN** the frontend is built for a shared environment
- **WHEN** an operator follows the documented build and deployment steps
- **THEN** the documentation MUST identify the required Sentry frontend build variables, release value, source map upload inputs, and secret-handling rules without committing Sentry auth tokens or writing them to Terraform state

#### Scenario: Verification commands are documented

- **GIVEN** a contributor or operator prepares a change for release
- **WHEN** they read the repository setup or deployment documentation
- **THEN** the documentation MUST identify the required clean install, type-check, lint, format-check, Vitest, Playwright, Sentry smoke verification, source-map verification, and Application Insights/Sentry boundary checks for the target architecture

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