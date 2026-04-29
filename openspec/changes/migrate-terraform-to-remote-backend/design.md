## Context

Terraform state for `infra/terraform/` is currently stored in a workstation-local file. Verified by the April-29 review:

- `infra/terraform/terraform.tfstate` (~110 KB) and two `.backup` siblings exist on the developer machine, contain plaintext primary/secondary access keys for Storage and Managed Redis, and are properly `.gitignore`'d so they are not in git.
- The repo's own [infra/terraform/README.md](infra/terraform/README.md) explicitly says "Terraform state can still contain generated secret material … use a secure remote backend before team or production use." That step has not been done.
- All the secrets in question are also written to Key Vault by the same Terraform run ([backend/src/lib/db.ts](backend/src/lib/db.ts) consumes via Key Vault references), so the runtime application does not depend on the local state file — only the Terraform workflow does.

Constraints:
- No CI/CD pipeline currently runs `terraform apply`; operators run from workstations. The remote backend has to work for that workflow first.
- Storage shared-key access is disabled by org policy on all storage accounts ([infra/terraform/main.tf](infra/terraform/main.tf) sets `shared_access_key_enabled = false`). The state-store storage account therefore must use AAD auth (`use_azuread_auth = true`).
- Operators authenticate as themselves via `az login`. The state-store account must be in a known subscription with consistent RBAC.
- Multiple environments will eventually exist (`dev`, future `prod`); the backend must support per-environment isolation without code changes.

## Goals / Non-Goals

**Goals:**
- Move Terraform state off workstation disks for every environment.
- Keep the workflow accessible to a single operator using `az login` (no service principal mandate).
- Ensure no Terraform action requires a key in any `.tfstate*` file or any `.tfvars` file beyond the example.
- Rotate the specific Storage / Redis / SQL access keys captured in the existing local state files.
- Document the bootstrap and rotation steps so a fresh contributor can replicate the setup.

**Non-Goals:**
- Building a CI/CD apply pipeline (out of scope; workflow stays operator-driven).
- Migrating to Terraform Cloud or HCP — Azure Storage backend is sufficient and stays inside the same tenant.
- Replacing access-key auth with managed identity for Redis or Storage at the application layer (separate hardening work; this change is about the Terraform layer).
- Importing the existing resource group / resources via fresh state — `terraform init -migrate-state` preserves the resource graph as-is.

## Decisions

### D1 — Use the `azurerm` backend with `use_azuread_auth = true`
The backend block goes in [infra/terraform/providers.tf](infra/terraform/providers.tf):

```hcl
terraform {
  backend "azurerm" {
    use_azuread_auth = true
    # subscription_id, resource_group_name, storage_account_name,
    # container_name, key all supplied via -backend-config=backend.config
  }
}
```

`use_azuread_auth = true` lets operators use `az login` with no shared key, matching the "shared-key disabled" posture used everywhere else.

**Alternatives considered**: (a) Hard-code the backend args inline — rejected because the same module will eventually serve `dev` and `prod`, and partial config keeps the Terraform code environment-agnostic. (b) HCP Terraform / Terraform Cloud — adds a third-party dependency for a one-developer team and crosses a tenant boundary unnecessarily.

### D2 — Bootstrap script (not Terraform-managed)
The state-store Storage account must exist before `terraform init`. Add [infra/terraform/bootstrap-state.sh](infra/terraform/bootstrap-state.sh) as an idempotent shell script that uses `az` to:
1. Create resource group `rg-m365copilot-tfstate-<env>` if missing.
2. Create Storage account `sttfstate<short>-<env>-<suffix>` with: TLS 1.2 minimum, public network access disabled by default policy where allowed (or restricted to operator IP), shared-key auth **disabled**, blob versioning **enabled**, blob soft-delete enabled (≥ 7 days), container soft-delete enabled.
3. Create container `tfstate` with `private` access.
4. Grant the calling user `Storage Blob Data Contributor` on the account.
5. Print the resulting `backend.config` snippet for `terraform init`.

This is intentionally **not** a Terraform resource because that would require Terraform state to manage the state store (chicken/egg). The script is the one piece of imperative infra in this codebase — it is short, idempotent, and only runs once per environment.

**Alternatives considered**: (a) Manage the state account with a separate `infra/terraform-bootstrap/` module that itself uses local state — rejected because then we still have a local-state surface that has to be defended; the script is simpler and the state account has a small, well-known shape. (b) Make every operator hand-create the account through the portal — rejected because it loses repeatability and makes settings drift inevitable.

### D3 — Per-environment state via partial config + `backend.config` file
Keep `infra/terraform/backend.config.example`:

```ini
subscription_id      = "<your-subscription-id>"
resource_group_name  = "rg-m365copilot-tfstate-dev"
storage_account_name = "sttfstatecpbngdev<suffix>"
container_name       = "tfstate"
key                  = "dev.tfstate"
```

Operators copy to `backend.config` (gitignored), edit, then `terraform init -backend-config=backend.config -migrate-state`. The `key` differs per env so promoting to `prod` is just a different filename.

`.gitignore` already covers `*.tfvars` and `*.tfstate`; add an explicit `infra/terraform/backend.config` line **with** an `!*.example` exception so the template stays in git.

### D4 — Key rotation runbook
The local state contains:
- Storage account `primary_access_key` and `secondary_access_key` (Functions deployment storage)
- Managed Redis `primary_access_key` and `secondary_access_key`
- SQL `primary_access_key` and `secondary_access_key` (admin-mode keys; runtime uses MSI)

Rotation order matters because `azurerm_key_vault_secret.redis_connection_string` embeds the Redis primary key:

1. Bootstrap remote state and migrate (D2 + D3). Do this BEFORE rotation so that the new key values land in the remote state immediately, never on local disk.
2. **Storage**: `az storage account keys renew --account-name <fn-storage> --key primary` then `--key secondary`. Functions auth via MSI so they do not need a restart; verify with `curl /api/health`.
3. **Redis**: `az redisenterprise database regenerate-key --resource-group <rg> --cluster-name <redis> --database-name default --key-type primary` then `--key-type secondary`. Then `terraform apply` (state diff updates `azurerm_key_vault_secret.redis_connection_string`), then `az functionapp restart` so the new Key Vault reference is read.
4. **SQL**: same regenerate flow for both keys.
5. Document the operator must shred any local `terraform.tfstate*` files after migration:
   ```bash
   shred -u infra/terraform/terraform.tfstate*
   shred -u infra/terraform/tfplan
   ```

**Alternatives considered**: skip rotation because the keys are gitignored — rejected. The keys spent ≥ 24 hours on a workstation outside any access-controlled boundary; per the project's stated threat model (multi-tenant Azure, public PR repo) we treat that as compromise.

### D5 — Update specs, not just docs
The runtime-settings expectation in `target-runtime-architecture` is the right home for "no local state" because it already covers Terraform deployment configuration. The public-secret-hygiene requirement in `open-source-readiness` already says "moved to secure deployment storage" — add an explicit Terraform-state scenario.

## Risks / Trade-offs

- **[Risk] First operator after the change cannot `terraform init` until they bootstrap** → Mitigation: prominently document the bootstrap step at the top of [infra/terraform/README.md](infra/terraform/README.md) before the `Configure` section; ship `bootstrap-state.sh` with `--help` and a dry-run mode.
- **[Risk] State migration corrupts an in-progress plan** → Mitigation: refuse to migrate when there is any pending `tfplan` (script asserts via `[[ -f tfplan ]] && exit 1`); have the operator complete or discard pending plans first.
- **[Risk] Key rotation breaks Function App between Redis key regen and Function restart** → Mitigation: Redis has primary AND secondary keys; rotate secondary first (no app impact), apply Terraform (which uses primary by default — leave that alone for now), restart, verify, then rotate primary, apply, restart again. The connection-string secret in Key Vault always points at primary so the in-flight transition is safe.
- **[Risk] State-store storage account needs sufficient RBAC for additional operators** → Mitigation: bootstrap script accepts a `--grant-user <upn>` flag for adding additional `Storage Blob Data Contributor` assignments.
- **[Trade-off] Bootstrap script is bash-only** → Acceptable: matches the existing macOS/zsh-first developer environment; PowerShell parity can be added later.

## Migration Plan

1. Land the Terraform code change (new backend block, bootstrap script, `backend.config.example`, README updates) WITHOUT running `terraform init` yet.
2. Operator runs `infra/terraform/bootstrap-state.sh dev`.
3. Operator copies `backend.config.example` to `backend.config`, edits, then `terraform init -backend-config=backend.config -migrate-state`. Confirm Terraform reports "Successfully configured the backend".
4. `terraform plan` — expect zero changes (the migration only moved state, not resources).
5. Rotate Storage / Redis / SQL keys per D4 runbook order. Run `terraform apply` after each step that touches a key vault secret.
6. `az functionapp restart` to load the rotated Redis connection string.
7. `curl /api/health` and `curl /api/leaderboard` to verify.
8. Operator shreds local `terraform.tfstate*` and `tfplan` files.

**Rollback (state migration only — key rotation is irreversible):**
- `terraform init -backend=false` then re-run `terraform init` against the local backend with `-migrate-state` to copy state back. Document this as emergency-only.
