## ADDED Requirements

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
