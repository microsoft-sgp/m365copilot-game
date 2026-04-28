# Policy And Quota Checks

Live Azure policy and quota checks were not completed while generating this template because:

- Azure CLI authentication was unavailable or timed out for policy queries.
- Terraform was not installed locally.
- The deployment region is `koreacentral` for all resources except Azure Communication Services (which keeps `data_location = "United States"` because the service is not available in every region). Quota usage needs an authenticated Azure CLI context.

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
| `Microsoft.Web/serverfarms`                        | 2     | Functions Premium (EP1) plan + frontend App Service plan (B1)                          |
| `Microsoft.Web/sites` (functionapp)                | 1     | Linux Function App on the EP1 plan                                                     |
| `Microsoft.Web/sites` (app)                        | 1     | Linux App Service hosting the Vue frontend                                             |
| `Microsoft.Storage/storageAccounts`                | 1     | Backing storage for the Function App                                                   |
| `Microsoft.Sql/servers`                            | 1     | Korea Central                                                                          |
| `Microsoft.Sql/servers/databases`                  | 1     | `bingo_db`                                                                             |
| `Microsoft.Cache/Redis`                            | 1     | Korea Central                                                                          |
| `Microsoft.Communication/communicationServices`    | 1     | `data_location` outside Korea Central (default `United States`); regional exception    |
| `Microsoft.Communication/emailServices`            | 1     | Same regional exception as above                                                       |
| `Microsoft.Communication/emailServices/domains`    | 1     | Azure-managed sender domain                                                            |
| `Microsoft.KeyVault/vaults`                        | 1     | Korea Central                                                                          |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | 1     | Used for SQL Microsoft Entra authentication                                            |
| `Microsoft.OperationalInsights/workspaces`         | 1     | Korea Central                                                                          |
| `Microsoft.Insights/components`                    | 1     | Application Insights (workspace-based)                                                 |
