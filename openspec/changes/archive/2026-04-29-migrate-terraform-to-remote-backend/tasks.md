## 1. Bootstrap script for the state store

- [x] 1.1 Create [infra/terraform/bootstrap-state.sh](infra/terraform/bootstrap-state.sh) that takes one positional argument (the environment, e.g. `dev`) and one optional `--grant-user <upn>` flag. Make it idempotent (safe to re-run). Use `set -euo pipefail`.
- [x] 1.2 In the script, derive: `state_rg="rg-m365copilot-tfstate-${env}"`, `state_account` (≤24 chars, all lowercase + numeric, deterministic from `name_prefix` + `env` + a 4-char random suffix written to a `.bootstrap-suffix-${env}` file so re-runs reuse the same name), and `container_name="tfstate"`.
- [x] 1.3 In the script, `az group create` (idempotent), then `az storage account create` with `--min-tls-version TLS1_2 --allow-shared-key-access false --kind StorageV2 --sku Standard_LRS`. After creation, `az storage account blob-service-properties update` to enable `--enable-versioning true`, `--enable-delete-retention true --delete-retention-days 7`, and `--enable-container-delete-retention true --container-delete-retention-days 7`.
- [x] 1.4 In the script, create the `tfstate` container with `--public-access off --auth-mode login`. Grant the calling user (or `--grant-user`) the `Storage Blob Data Contributor` role at the storage account scope.
- [x] 1.5 At the end, the script MUST print a copy-paste-ready `backend.config` snippet to stdout containing `subscription_id`, `resource_group_name`, `storage_account_name`, `container_name`, and `key="${env}.tfstate"`.
- [x] 1.6 Add a `--help` text and a `--dry-run` mode that prints the planned `az` commands without executing.
- [x] 1.7 `chmod +x infra/terraform/bootstrap-state.sh`. Smoke-test against a real subscription (or document the smoke test in the PR if no test sub is available).

## 2. Terraform backend configuration

- [x] 2.1 In [infra/terraform/providers.tf](infra/terraform/providers.tf), add a `terraform { backend "azurerm" {} }` block configured with `use_azuread_auth = true` and no inline `subscription_id` / `resource_group_name` / `storage_account_name` / `container_name` / `key` (they come from `-backend-config`).
- [x] 2.2 Create [infra/terraform/backend.config.example](infra/terraform/backend.config.example) with placeholder lines for the five keys, plus a header comment that says "Copy to backend.config (gitignored), edit, then run `terraform init -backend-config=backend.config -migrate-state`".
- [x] 2.3 Update [.gitignore](.gitignore) to add `infra/terraform/backend.config` and `infra/terraform/.bootstrap-suffix-*` while preserving the existing `!**/*.tfvars.example` exception. Ensure `backend.config.example` is NOT ignored (verify with `git check-ignore`).

## 3. Documentation update

- [x] 3.1 In [infra/terraform/README.md](infra/terraform/README.md), add a new "Bootstrap remote state" section that runs **before** the existing "Configure" section. Document: prerequisites (subscription owner / contributor), running `bootstrap-state.sh dev`, copying `backend.config.example` to `backend.config`, and `terraform init -backend-config=backend.config -migrate-state` for first-time setup.
- [x] 3.2 In [infra/terraform/README.md](infra/terraform/README.md), update the "Notes" section to delete the "use a secure remote backend before team or production use" advisory (now mandatory in the bootstrap section). Add a new note that says local state is no longer supported and any pre-existing `terraform.tfstate*` must be `shred -u`'d after migration.
- [x] 3.3 In [infra/terraform/README.md](infra/terraform/README.md), add a "Key rotation" section documenting the four-step order from the design doc (bootstrap+migrate, rotate Storage, rotate Redis + apply + restart, rotate SQL).
- [x] 3.4 Cross-link the new sections from [DEPLOYMENT.md](DEPLOYMENT.md) if it references Terraform setup.

## 4. State migration (operator action — runbook in tasks for tracking)

- [x] 4.1 Confirm there is no pending `tfplan` file in `infra/terraform/`; if there is, complete or discard it.
- [x] 4.2 Run `infra/terraform/bootstrap-state.sh dev`. Capture the printed `backend.config` snippet.
- [x] 4.3 `cp backend.config.example backend.config`, edit with the values from 4.2, verify `git check-ignore backend.config` returns the path.
- [x] 4.4 Run `terraform init -backend-config=backend.config -migrate-state`. Confirm "Successfully configured the backend".
- [x] 4.5 Run `terraform plan` and confirm zero changes.
- [x] 4.6 Verify the new state blob exists: `az storage blob list --account-name <state-account> --container-name tfstate --auth-mode login -o table`.

## 5. Key rotation (operator action)

- [x] 5.1 **Storage account keys** — rotate secondary then primary: `az storage account keys renew --account-name <fn-storage-account> --resource-group <rg> --key secondary` then `--key primary`. Confirm `curl <function-app-url>/api/health` still returns `ok: true` (Functions auth via MSI; rotation should not cause downtime).
- [x] 5.2 **Managed Redis keys** — rotate secondary first: `az redisenterprise database regenerate-key --resource-group <rg> --cluster-name <redis-name> --database-name default --key-type secondary`. Then `terraform plan` — expect no changes (only primary feeds the connection string). Then rotate primary: same command with `--key-type primary`. Then `terraform apply` (the `redis_connection_string` Key Vault secret updates), then `az functionapp restart --name <func-name> --resource-group <rg>`.
- [x] 5.3 Verify post-rotation: `curl <function-app-url>/api/leaderboard?campaign=APR26` still returns 200, and `az functionapp log tail` shows no `redis_cache_connect_failed` events for ≥ 60 seconds after restart.
- [x] 5.4 **SQL keys** (admin-mode keys; runtime is MSI but rotate to clear the value from the threat model): `az sql server key list ...` to inspect, then regenerate via the appropriate `az sql server` command. Verify migration runner ([backend/scripts/run-migrations.mjs](backend/scripts/run-migrations.mjs)) still works under MSI with `node backend/scripts/run-migrations.mjs --dry-run` (or simply confirm a no-op migration round-trip).
- [x] 5.5 `shred -u infra/terraform/terraform.tfstate*` and `shred -u infra/terraform/tfplan` (if any). Confirm with `ls -la infra/terraform/` that no `.tfstate*` or `tfplan*` files remain on disk.

## 6. Validation

- [x] 6.1 `git status` MUST show `backend.config` is not staged; `backend.config.example` IS staged.
- [x] 6.2 `terraform fmt -check -recursive` and `terraform validate` both pass.
- [x] 6.3 `openspec validate --strict migrate-terraform-to-remote-backend` passes.
- [x] 6.4 In a separate clone of the repo, an operator can: clone → `bootstrap-state.sh dev` (with their own subscription) → `cp backend.config.example backend.config` → edit → `terraform init -backend-config=backend.config` → `terraform plan` succeeds.
