# Policy And Quota Checks

Complete Azure policy and quota checks before running `terraform apply` because:

- Azure policy and quota availability can change by subscription and region.
- The current template pins regional resources to Korea Central.
- The deployment region is `koreacentral` for all regional resources. Azure Communication Services is the only global control-plane exception and keeps `data_location = "United States"` for data residency. Quota usage needs an authenticated Azure CLI context.

Before running `terraform apply`, complete these checks:

```bash
az login
az account set --subscription "<your-subscription-id>"
az extension add --name quota
```

Recommended quota/policy checks:

```bash
# Policy assignments
az policy assignment list \
  --scope /subscriptions/<your-subscription-id> \
  --output table

# Resource Graph count checks, if quota CLI does not support a provider
az extension add --name resource-graph
az graph query -q "resources | where resourceGroup =~ 'rg-m365copilot-game-dev' | summarize count() by type"
```

Resources planned:

| Resource Type                                      | Count | Notes                                                                                  |
| -------------------------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| `Microsoft.Resources/resourceGroups`               | 1     | `rg-m365copilot-game-dev` in `koreacentral`                                            |
| `Microsoft.Web/serverfarms`                        | 2     | Function App plan + frontend App Service plan; current tfvars use `P0v3` for both      |
| `Microsoft.Web/sites` (functionapp)                | 1     | Linux Function App on the configured App Service plan                                   |
| `Microsoft.Web/sites` (app)                        | 1     | Linux App Service hosting the Vue frontend                                             |
| `Microsoft.Storage/storageAccounts`                | 1     | Backing storage for the Function App                                                   |
| `Microsoft.Sql/servers`                            | 1     | Korea Central                                                                          |
| `Microsoft.Sql/servers/databases`                  | 1     | `bingo_db`                                                                             |
| `Microsoft.Cache/redisEnterprise`                  | 1     | Azure Managed Redis in Korea Central                                                   |
| `Microsoft.Communication/communicationServices`    | 1     | Global control-plane resource; `data_location` defaults to `United States`             |
| `Microsoft.Communication/emailServices`            | 1     | Global control-plane resource; same `data_location` exception as above                 |
| `Microsoft.Communication/emailServices/domains`    | 1     | Azure-managed sender domain                                                            |
| `Microsoft.KeyVault/vaults`                        | 1     | Korea Central                                                                          |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | 1     | Used for SQL Microsoft Entra authentication                                            |
| `Microsoft.OperationalInsights/workspaces`         | 1     | Korea Central                                                                          |
| `Microsoft.Insights/components`                    | 1     | Application Insights (workspace-based)                                                 |
