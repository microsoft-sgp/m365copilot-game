data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 6
  lower   = true
  numeric = true
  special = false
  upper   = false
}

resource "random_password" "admin_key" {
  length  = 48
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

locals {
  normalized_name = replace(lower(var.name_prefix), "/[^a-z0-9]/", "")
  short_name      = substr(local.normalized_name, 0, 10)
  suffix          = random_string.suffix.result

  storage_account_name = substr("st${local.short_name}${var.environment}${local.suffix}", 0, 24)
  key_vault_name       = substr("kv-${local.short_name}-${var.environment}-${local.suffix}", 0, 24)

  resource_prefix = "${var.name_prefix}-${var.environment}"
  tags = merge(var.tags, {
    application = var.name_prefix
    environment = var.environment
    managed_by  = "terraform"
  })
  function_app_name      = substr("func-${local.resource_prefix}-${local.suffix}", 0, 32)
  service_plan_name      = substr("plan-${local.resource_prefix}-${local.suffix}", 0, 60)
  function_identity_name = substr("id-${local.resource_prefix}-${local.suffix}", 0, 60)
  frontend_web_app_name  = substr("app-${local.resource_prefix}-${local.suffix}", 0, 60)
  frontend_plan_name     = substr("plan-fe-${local.resource_prefix}-${local.suffix}", 0, 60)
  sql_server_name        = substr("sql-${local.resource_prefix}-kc-${local.suffix}", 0, 63)
  log_workspace_name     = substr("log-${local.resource_prefix}-${local.suffix}", 0, 63)
  app_insights_name      = substr("appi-${local.resource_prefix}-${local.suffix}", 0, 63)
  acs_name               = substr("acs-${local.resource_prefix}-${local.suffix}", 0, 63)
  acs_email_name         = substr("acs-email-${local.resource_prefix}-${local.suffix}", 0, 63)
  redis_name             = substr("redis-${local.resource_prefix}-${local.suffix}", 0, 63)

  acs_email_sender_address = "${var.acs_sender_username}@${azurerm_email_communication_service_domain.admin_otp.from_sender_domain}"
  allowed_origins = distinct(concat(
    ["https://${azurerm_linux_web_app.frontend.default_hostname}"],
    var.allowed_origins,
  ))

  app_settings = {
    AzureWebJobsFeatureFlags          = "EnableWorkerIndexing"
    SQL_SERVER_FQDN                   = azurerm_mssql_server.main.fully_qualified_domain_name
    SQL_DATABASE_NAME                 = azurerm_mssql_database.app.name
    SQL_AUTHENTICATION                = "azure-active-directory-msi-app-service"
    SQL_MANAGED_IDENTITY_CLIENT_ID    = azurerm_user_assigned_identity.functions.client_id
    ADMIN_KEY                         = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.admin_key.id})"
    JWT_SECRET                        = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.jwt_secret.id})"
    ADMIN_EMAILS                      = join(",", var.admin_emails)
    ADMIN_ACCESS_TTL_SECONDS          = tostring(var.admin_access_ttl_seconds)
    ADMIN_REFRESH_TTL_SECONDS         = tostring(var.admin_refresh_ttl_seconds)
    ADMIN_STEP_UP_TTL_SECONDS         = tostring(var.admin_step_up_ttl_seconds)
    ADMIN_COOKIE_SECURE               = "true"
    ADMIN_COOKIE_SAMESITE             = "None"
    ADMIN_COOKIE_PATH                 = "/api/portal-api"
    ALLOWED_ORIGINS                   = join(",", local.allowed_origins)
    ACS_CONNECTION_STRING             = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.acs_connection_string.id})"
    ACS_EMAIL_SENDER                  = local.acs_email_sender_address
    REDIS_CONNECTION_STRING           = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.redis_connection_string.id})"
    CACHE_TTL_ACTIVE_CAMPAIGN_SECONDS = tostring(var.cache_ttl_active_campaign_seconds)
    CACHE_TTL_ORG_DOMAINS_SECONDS     = tostring(var.cache_ttl_org_domains_seconds)
    CACHE_TTL_LEADERBOARD_SECONDS     = tostring(var.cache_ttl_leaderboard_seconds)
    DEFAULT_CAMPAIGN_ID               = var.default_campaign_id
    LEADERBOARD_SOURCE                = var.leaderboard_source
    ENABLE_PACK_ASSIGNMENT_LIFECYCLE  = tostring(var.enable_pack_assignment_lifecycle)
  }
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.resource_group_location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = local.log_workspace_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "api" {
  name                = local.app_insights_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.tags
}

resource "azurerm_storage_account" "functions" {
  name                            = local.storage_account_name
  resource_group_name             = azurerm_resource_group.main.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true
  tags                            = local.tags
}

resource "azurerm_user_assigned_identity" "functions" {
  name                = local.function_identity_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  tags                = local.tags
}

resource "azurerm_key_vault" "main" {
  name                       = local.key_vault_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = var.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = true
  tags                       = local.tags

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Backup",
      "Delete",
      "Get",
      "List",
      "Purge",
      "Recover",
      "Restore",
      "Set",
    ]
  }

  lifecycle {
    ignore_changes = [access_policy]
  }
}

resource "azurerm_mssql_server" "main" {
  name                          = local.sql_server_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = var.sql_location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true
  tags                          = local.tags

  azuread_administrator {
    login_username              = "terraform-deployer"
    object_id                   = data.azurerm_client_config.current.object_id
    tenant_id                   = data.azurerm_client_config.current.tenant_id
    azuread_authentication_only = true
  }
}

resource "azurerm_mssql_database" "app" {
  name                 = var.sql_database_name
  server_id            = azurerm_mssql_server.main.id
  sku_name             = var.sql_database_sku_name
  max_size_gb          = 2
  storage_account_type = "Local"
  tags                 = local.tags
}

resource "azurerm_mssql_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_mssql_firewall_rule" "allowed_clients" {
  for_each = var.sql_allowed_ip_ranges

  name             = each.key
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = each.value.start_ip_address
  end_ip_address   = each.value.end_ip_address
}

resource "azurerm_communication_service" "admin_otp" {
  name                = local.acs_name
  resource_group_name = azurerm_resource_group.main.name
  data_location       = var.communication_data_location
  tags                = local.tags
}

resource "azurerm_email_communication_service" "admin_otp" {
  name                = local.acs_email_name
  resource_group_name = azurerm_resource_group.main.name
  data_location       = var.communication_data_location
  tags                = local.tags
}

resource "azurerm_email_communication_service_domain" "admin_otp" {
  name              = "AzureManagedDomain"
  email_service_id  = azurerm_email_communication_service.admin_otp.id
  domain_management = "AzureManaged"
  tags              = local.tags
}

resource "azurerm_email_communication_service_domain_sender_username" "admin_otp" {
  name                    = var.acs_sender_username
  email_service_domain_id = azurerm_email_communication_service_domain.admin_otp.id
  display_name            = var.acs_sender_display_name
}

resource "azurerm_communication_service_email_domain_association" "admin_otp" {
  communication_service_id = azurerm_communication_service.admin_otp.id
  email_service_domain_id  = azurerm_email_communication_service_domain.admin_otp.id
}

resource "azurerm_redis_cache" "api" {
  name                          = local.redis_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = var.location
  capacity                      = var.redis_capacity
  family                        = var.redis_family
  sku_name                      = var.redis_sku_name
  minimum_tls_version           = "1.2"
  non_ssl_port_enabled          = false
  public_network_access_enabled = var.redis_public_network_access_enabled
  redis_version                 = var.redis_version
  tags                          = local.tags

  redis_configuration {
    maxmemory_policy = var.redis_maxmemory_policy
  }
}

resource "azurerm_key_vault_secret" "admin_key" {
  name         = "admin-key"
  value        = random_password.admin_key.result
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.jwt_secret.result
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "acs_connection_string" {
  name         = "acs-connection-string"
  value        = azurerm_communication_service.admin_otp.primary_connection_string
  key_vault_id = azurerm_key_vault.main.id
  content_type = "connection-string"
}

resource "azurerm_key_vault_secret" "redis_connection_string" {
  name         = "redis-connection-string"
  value        = azurerm_redis_cache.api.primary_connection_string
  key_vault_id = azurerm_key_vault.main.id
  content_type = "connection-string"
}

resource "azurerm_service_plan" "functions" {
  name                = local.service_plan_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.function_plan_sku_name
  tags                = local.tags
}

resource "azurerm_service_plan" "frontend" {
  name                = local.frontend_plan_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.frontend_app_service_sku_name
  tags                = local.tags
}

resource "azurerm_linux_web_app" "frontend" {
  name                          = local.frontend_web_app_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = var.location
  service_plan_id               = azurerm_service_plan.frontend.id
  https_only                    = true
  public_network_access_enabled = true
  tags                          = local.tags

  app_settings = {
    WEBSITE_NODE_DEFAULT_VERSION          = "~24"
    SCM_DO_BUILD_DURING_DEPLOYMENT        = "false"
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.api.connection_string
  }

  site_config {
    minimum_tls_version     = "1.2"
    scm_minimum_tls_version = "1.2"
    always_on               = true
    ftps_state              = "Disabled"
    http2_enabled           = true
    app_command_line        = "pm2 serve /home/site/wwwroot --no-daemon --spa"

    application_stack {
      node_version = "24-lts"
    }
  }
}

resource "azurerm_linux_function_app" "api" {
  name                          = local.function_app_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = var.location
  service_plan_id               = azurerm_service_plan.functions.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_account_access_key    = azurerm_storage_account.functions.primary_access_key
  https_only                    = true
  public_network_access_enabled = true
  app_settings                  = local.app_settings
  tags                          = local.tags

  identity {
    type         = "SystemAssigned, UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.functions.id]
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.api.connection_string
    minimum_tls_version                    = "1.2"
    scm_minimum_tls_version                = "1.2"
    pre_warmed_instance_count              = var.function_pre_warmed_instance_count
    ftps_state                             = "Disabled"
    http2_enabled                          = true

    application_stack {
      node_version = "24"
    }

    cors {
      allowed_origins     = local.allowed_origins
      support_credentials = true
    }
  }

  depends_on = [
    azurerm_key_vault_secret.acs_connection_string,
    azurerm_key_vault_secret.admin_key,
    azurerm_key_vault_secret.jwt_secret,
    azurerm_key_vault_secret.redis_connection_string,
  ]
}

resource "azurerm_key_vault_access_policy" "function_secrets" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_function_app.api.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List",
  ]
}
