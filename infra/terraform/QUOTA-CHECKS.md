# Policy And Quota Checks

Live Azure policy and quota checks were not completed while generating this template because:

- Azure CLI authentication was unavailable or timed out for policy queries.
- Terraform was not installed locally.
- The deployment region was confirmed as `eastus2`, but quota usage needs an authenticated Azure CLI context.

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

| Resource Type                                      | Count |
| -------------------------------------------------- | ----- |
| `Microsoft.Resources/resourceGroups`               | 1     |
| `Microsoft.Web/staticSites`                        | 1     |
| `Microsoft.Web/serverfarms`                        | 1     |
| `Microsoft.Web/sites`                              | 1     |
| `Microsoft.Storage/storageAccounts`                | 1     |
| `Microsoft.Sql/servers`                            | 1     |
| `Microsoft.Sql/servers/databases`                  | 1     |
| `Microsoft.Communication/communicationServices`    | 1     |
| `Microsoft.Communication/emailServices`            | 1     |
| `Microsoft.Communication/emailServices/domains`    | 1     |
| `Microsoft.KeyVault/vaults`                        | 1     |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | 1     |
| `Microsoft.OperationalInsights/workspaces`         | 1     |
| `Microsoft.Insights/components`                    | 1     |
