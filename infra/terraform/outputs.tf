output "resource_group_name" {
  description = "Resource group containing the app resources."
  value       = azurerm_resource_group.main.name
}

output "function_app_name" {
  description = "Azure Function App name for backend deployment."
  value       = azurerm_linux_function_app.api.name
}

output "function_app_url" {
  description = "Backend Function App base URL."
  value       = "https://${azurerm_linux_function_app.api.default_hostname}"
}

output "api_base_url" {
  description = "Frontend VITE_API_BASE value for build/deploy."
  value       = "https://${azurerm_linux_function_app.api.default_hostname}/api"
}

output "frontend_web_app_name" {
  description = "Linux App Service name hosting the Vue frontend."
  value       = azurerm_linux_web_app.frontend.name
}

output "frontend_web_app_url" {
  description = "Frontend Linux App Service URL."
  value       = "https://${azurerm_linux_web_app.frontend.default_hostname}"
}

output "sql_server_fqdn" {
  description = "Azure SQL server fully qualified domain name."
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
}

output "sql_database_name" {
  description = "Azure SQL database name."
  value       = azurerm_mssql_database.app.name
}

output "virtual_network_name" {
  description = "Virtual network used for Function App VNet integration and SQL Private Link."
  value       = azurerm_virtual_network.main.name
}

output "sql_private_endpoint_name" {
  description = "Private Endpoint used by the Function App to reach Azure SQL."
  value       = azurerm_private_endpoint.sql.name
}

output "sql_private_dns_zone_name" {
  description = "Private DNS zone linked to the VNet for Azure SQL Private Link resolution."
  value       = azurerm_private_dns_zone.sql.name
}

output "key_vault_private_endpoint_name" {
  description = "Private Endpoint used by the Function App to resolve Key Vault-backed app settings."
  value       = azurerm_private_endpoint.key_vault.name
}

output "key_vault_private_dns_zone_name" {
  description = "Private DNS zone linked to the VNet for Key Vault Private Link resolution."
  value       = azurerm_private_dns_zone.key_vault.name
}

output "function_key_vault_reference_identity_client_id" {
  description = "Client ID of the user-assigned managed identity used for Function App Key Vault references."
  value       = azurerm_user_assigned_identity.functions.client_id
}

output "function_sql_identity_name" {
  description = "User-assigned managed identity name granted database access by the migration runner."
  value       = azurerm_user_assigned_identity.functions.name
}

output "function_sql_identity_client_id" {
  description = "Client ID used by the Function App for Azure SQL managed identity authentication."
  value       = azurerm_user_assigned_identity.functions.client_id
}

output "key_vault_name" {
  description = "Key Vault containing generated app secrets."
  value       = azurerm_key_vault.main.name
}

output "redis_cache_name" {
  description = "Azure Managed Redis name used by the Function App cache layer."
  value       = azurerm_managed_redis.api.name
}

output "managed_redis_name" {
  description = "Azure Managed Redis name used by the Function App cache layer."
  value       = azurerm_managed_redis.api.name
}

output "redis_hostname" {
  description = "Azure Managed Redis hostname. Connection secrets are stored in Key Vault and not output."
  value       = azurerm_managed_redis.api.hostname
}

output "acs_email_sender" {
  description = "Sender address configured for admin OTP email."
  value       = local.acs_email_sender_address
}

output "azure_portal_resource_group_url" {
  description = "Azure Portal link to the resource group."
  value       = "https://portal.azure.com/#@/resource/subscriptions/${var.subscription_id}/resourceGroups/${azurerm_resource_group.main.name}/overview"
}
