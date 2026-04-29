## MODIFIED Requirements

### Requirement: Public Secret Hygiene

The repository SHALL avoid committed production secrets, SHALL provide placeholder-only examples for local settings, deployment values, keys, connection strings, tokens, and Terraform variables, AND Terraform state — which can contain provider-returned access keys — SHALL be held in a secure remote backend rather than on workstation disks for any environment beyond a one-off local plan-only experiment.

#### Scenario: Maintainer scans public docs before release

- **GIVEN** public release preparation includes a secret scan over docs and configuration examples
- **WHEN** the scan checks for real-looking keys, connection strings, deployment tokens, subscription identifiers, tenant identifiers, and production endpoints
- **THEN** any production secret or environment-specific private value MUST be removed, replaced with a placeholder, or moved to secure deployment storage before release

#### Scenario: User copies local setup examples

- **GIVEN** a user copies sample local configuration
- **WHEN** the sample contains credentials or keys
- **THEN** the sample MUST clearly identify them as local-only or placeholder values and MUST tell users not to reuse them in shared, staging, or production environments

#### Scenario: Terraform state is held in a remote backend

- **GIVEN** any environment provisioned through `infra/terraform/`
- **WHEN** an operator runs `terraform init`, `plan`, or `apply`
- **THEN** state MUST be written only to the configured Azure Storage remote backend with Azure AD auth, the operator runbook MUST document deleting any pre-migration `terraform.tfstate*` files from local disk, and the documentation MUST state explicitly that any access key that was previously captured in a local state file MUST be rotated before treating the migration as complete
