## Why

The April-29 security review confirmed that local `terraform.tfstate*` and `terraform.tfvars` files exist in developer working directories ([infra/terraform/](infra/terraform/)) containing plaintext Storage account keys, Managed Redis primary/secondary keys, and SQL primary/secondary keys. The files are properly `.gitignore`'d so they are not in the git repo, but a local-only state means: (1) every developer who has ever run `terraform apply` has those secrets sitting on disk where backups / IDE indexers / `tar`-the-repo can leak them, (2) two developers cannot collaborate on infra without a manual `tfstate` swap, and (3) the project's own [infra/terraform/README.md](infra/terraform/README.md) Notes section already says "use a secure remote backend before team or production use" — which has not been done. Closing this requires both a backend migration AND rotation of any access keys that were captured in those local state files.

## What Changes

- Add an Azure Storage `azurerm` backend to the Terraform root module so state is held in an encrypted, versioned, lease-protected blob instead of a workstation file. **BREAKING** for the local workflow: `terraform init` now requires the state-only Storage account to exist and the operator to have AAD `Storage Blob Data Contributor` on it.
- Provide a small bootstrap script ([infra/terraform/bootstrap-state.sh](infra/terraform/bootstrap-state.sh)) that idempotently creates the state Resource Group, Storage account (private blob, AAD-only auth, blob versioning + soft delete), and `tfstate` container — runnable once per environment without itself being managed by Terraform (chicken-and-egg).
- Update [infra/terraform/providers.tf](infra/terraform/providers.tf) and add an `azurerm` backend block referencing the bootstrapped account; require `use_azuread_auth = true` and `subscription_id` / `resource_group_name` / `storage_account_name` / `container_name` / `key` from a partial-config + `backend.config` template.
- Rotate every secret that ever appeared in a local state file:
  - **Storage account access keys** for the Functions deployment storage account — rotate both keys; verify Functions still run because they use Managed Identity (no app setting depends on the key).
  - **Azure Managed Redis primary/secondary access keys** — rotate both, then re-run `terraform apply` to refresh `azurerm_key_vault_secret.redis_connection_string` and restart the Function App so the new connection string is picked up.
  - **SQL primary/secondary** — verified to be admin-mode keys unused at runtime (Functions use MSI), but rotate to remove the captured value from the threat model.
- Update [infra/terraform/README.md](infra/terraform/README.md) with the new bootstrap + `terraform init -backend-config=...` flow, key-rotation runbook, and explicit "do not run with local state" guidance.
- Update [.gitignore](.gitignore) coverage if needed (already covers `*.tfstate` / `*.tfvars` / `tfplan` per audit) and add an explicit comment that the remote backend is now mandatory.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `target-runtime-architecture`: target deployment configuration requirement gains an explicit "Terraform state lives in remote backend" scenario; runtime-settings scenario gains a no-local-state expectation.
- `open-source-readiness`: public-secret-hygiene requirement gains a scenario stating that Terraform state must not be local for any environment beyond a developer's first plan-only experiment.

## Impact

- **Code / config**: [infra/terraform/providers.tf](infra/terraform/providers.tf) (backend block), [infra/terraform/versions.tf](infra/terraform/versions.tf) (no change expected), [infra/terraform/bootstrap-state.sh](infra/terraform/bootstrap-state.sh) (new), [infra/terraform/backend.config.example](infra/terraform/backend.config.example) (new), [infra/terraform/README.md](infra/terraform/README.md), [.gitignore](.gitignore) (sanity-only).
- **APIs / runtime code**: none.
- **Operations**: every operator must run the bootstrap once per environment, then `terraform init -backend-config=backend.config` once. Existing local state must be migrated via `terraform init -migrate-state`.
- **Secrets**: storage, Redis, and SQL keys rotated; Function App restart required so refreshed `REDIS_CONNECTION_STRING` (Key Vault reference) is loaded.
- **Affected teams**: ops/infra (bootstrap + rotation runbook), backend (no code change but a Function App restart window), security (verify rotation evidence).
- **Rollback**: the partial-config backend can be removed and `terraform init -migrate-state` run in reverse to copy state back to a local file. **However**, key rotation cannot be rolled back — the previous key values must be considered burned. Document this irreversibility in the runbook.
