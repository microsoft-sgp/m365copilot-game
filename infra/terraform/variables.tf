variable "subscription_id" {
  description = "Azure subscription ID used by the AzureRM provider."
  type        = string
  default     = "8b14080f-2d4f-4817-8b92-b0d85a6cc993"
}

variable "resource_group_name" {
  description = "Resource group name for the app resources. Terraform will create/manage this group unless you import an existing group first."
  type        = string
  default     = "rg-m365copilot-game-dev"
}

variable "location" {
  description = "Primary Azure region for all regional app resources. Must remain Korea Central; Azure Communication Services resources are globally scoped and use communication_data_location for data residency."
  type        = string
  default     = "koreacentral"

  validation {
    condition     = lower(var.location) == "koreacentral"
    error_message = "location must be koreacentral so all regional app resources deploy to Korea Central."
  }
}

variable "resource_group_location" {
  description = "Azure region metadata for the resource group. Must remain Korea Central for this deployment."
  type        = string
  default     = "koreacentral"

  validation {
    condition     = lower(var.resource_group_location) == "koreacentral"
    error_message = "resource_group_location must be koreacentral."
  }
}

variable "sql_location" {
  description = "Azure region for Azure SQL resources. Must remain Korea Central alongside the app resources."
  type        = string
  default     = "koreacentral"

  validation {
    condition     = lower(var.sql_location) == "koreacentral"
    error_message = "sql_location must be koreacentral so Azure SQL stays in Korea Central."
  }
}

variable "environment" {
  description = "Short environment label used in resource names and tags."
  type        = string
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z0-9-]{2,12}$", var.environment))
    error_message = "environment must be 2-12 lowercase letters, numbers, or hyphens."
  }
}

variable "name_prefix" {
  description = "Base name for generated Azure resources. Keep this short to satisfy global naming limits."
  type        = string
  default     = "m365copilot-game"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,32}$", var.name_prefix))
    error_message = "name_prefix must be 3-32 lowercase letters, numbers, or hyphens."
  }
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default = {
    application = "m365copilot-game"
    environment = "dev"
    managed_by  = "terraform"
  }
}

variable "admin_emails" {
  description = "Bootstrap admin emails for OTP login, mapped to ADMIN_EMAILS. Keep at least one break-glass admin here."
  type        = list(string)
  default     = ["admin@test.com"]

  validation {
    condition     = length(var.admin_emails) > 0
    error_message = "Provide at least one bootstrap admin email."
  }
}

variable "leaderboard_source" {
  description = "Leaderboard aggregation mode. Use progression for verified gameplay scoring, submissions for legacy rollback."
  type        = string
  default     = "progression"

  validation {
    condition     = contains(["progression", "submissions"], var.leaderboard_source)
    error_message = "leaderboard_source must be progression or submissions."
  }
}

variable "enable_pack_assignment_lifecycle" {
  description = "Enables server-authoritative pack assignment lifecycle."
  type        = bool
  default     = true
}

variable "enable_player_token_enforcement" {
  description = "Enable server-side enforcement of the per-player session token on game-API mutations. MUST stay true in production. Set to false only as an emergency rollback for the player-session-auth capability."
  type        = bool
  default     = true
}

variable "default_campaign_id" {
  description = "Default campaign ID used by legacy submission and cache invalidation paths."
  type        = string
  default     = "APR26"
}

variable "allowed_origins" {
  description = "Additional frontend origins allowed to make credentialed requests to the Function App. The frontend App Service default hostname is always included."
  type        = list(string)
  default     = []
}

variable "sentry_dsn" {
  description = "Sentry DSN for backend application observability. Leave empty to disable Sentry capture. Do not put SENTRY_AUTH_TOKEN or source-map upload credentials in Terraform variables."
  type        = string
  default     = ""

  validation {
    condition     = var.sentry_dsn == "" || can(regex("^https://", var.sentry_dsn))
    error_message = "sentry_dsn must be empty or an https:// Sentry DSN."
  }
}

variable "sentry_environment" {
  description = "Optional Sentry environment name. Defaults to the Terraform environment value when empty."
  type        = string
  default     = ""

  validation {
    condition     = var.sentry_environment == "" || can(regex("^[A-Za-z0-9_.-]{1,64}$", var.sentry_environment))
    error_message = "sentry_environment must be empty or a Sentry-compatible environment name without spaces or slashes."
  }
}

variable "sentry_release" {
  description = "Sentry release identifier shared by frontend and backend, preferably m365copilot-game@<git-sha>. Leave empty for deployments that do not publish release metadata."
  type        = string
  default     = ""
}

variable "sentry_traces_sample_rate" {
  description = "Backend Sentry trace sample rate from 0.0 to 1.0."
  type        = number
  default     = 0.1

  validation {
    condition     = var.sentry_traces_sample_rate >= 0 && var.sentry_traces_sample_rate <= 1
    error_message = "sentry_traces_sample_rate must be between 0 and 1."
  }
}

variable "sentry_enable_logs" {
  description = "Enable Sentry log capture for backend application logs when Sentry is configured."
  type        = bool
  default     = true
}

variable "sentry_capture_operational_errors" {
  description = "Capture handled operational failures such as ACS Email provider failures in Sentry when Sentry is configured."
  type        = bool
  default     = true
}

variable "sentry_flush_timeout_ms" {
  description = "Maximum milliseconds to wait for backend Sentry events to flush during Azure Functions error paths."
  type        = number
  default     = 2000

  validation {
    condition     = var.sentry_flush_timeout_ms >= 0 && var.sentry_flush_timeout_ms <= 10000
    error_message = "sentry_flush_timeout_ms must be between 0 and 10000."
  }
}

variable "admin_access_ttl_seconds" {
  description = "Lifetime for short-lived admin access cookies."
  type        = number
  default     = 900
}

variable "admin_refresh_ttl_seconds" {
  description = "Lifetime for admin refresh cookies."
  type        = number
  default     = 604800
}

variable "admin_step_up_ttl_seconds" {
  description = "Lifetime for admin-management step-up proof cookies."
  type        = number
  default     = 300
}

variable "cache_ttl_active_campaign_seconds" {
  description = "Redis TTL for active campaign config cache entries."
  type        = number
  default     = 60
}

variable "cache_ttl_org_domains_seconds" {
  description = "Redis TTL for organization domain map cache entries."
  type        = number
  default     = 300
}

variable "cache_ttl_leaderboard_seconds" {
  description = "Redis TTL for leaderboard cache entries."
  type        = number
  default     = 30
}

variable "redis_sku_name" {
  description = "Azure Managed Redis SKU name used by the API cache layer."
  type        = string
  default     = "Balanced_B0"

  validation {
    condition     = can(regex("^(Balanced_B|ComputeOptimized_X|FlashOptimized_A)[0-9]+$", var.redis_sku_name))
    error_message = "redis_sku_name must be an Azure Managed Redis SKU such as Balanced_B0, Balanced_B3, ComputeOptimized_X3, or FlashOptimized_A250."
  }
}

variable "redis_clustering_policy" {
  description = "Azure Managed Redis clustering policy. NoCluster keeps compatibility with the app's single-endpoint Redis client."
  type        = string
  default     = "NoCluster"

  validation {
    condition     = contains(["EnterpriseCluster", "OSSCluster", "NoCluster"], var.redis_clustering_policy)
    error_message = "redis_clustering_policy must be EnterpriseCluster, OSSCluster, or NoCluster."
  }
}

variable "redis_eviction_policy" {
  description = "Azure Managed Redis eviction policy for cache-aside entries."
  type        = string
  default     = "AllKeysLRU"

  validation {
    condition = contains([
      "AllKeysLFU",
      "AllKeysLRU",
      "AllKeysRandom",
      "VolatileLRU",
      "VolatileLFU",
      "VolatileTTL",
      "VolatileRandom",
      "NoEviction",
    ], var.redis_eviction_policy)
    error_message = "redis_eviction_policy must be a valid Azure Managed Redis eviction policy."
  }
}

variable "redis_public_network_access_enabled" {
  description = "Whether Azure Managed Redis allows public network access. Keep false only when private networking is configured."
  type        = bool
  default     = true
}

variable "key_vault_public_network_access_enabled" {
  description = "Whether Key Vault allows public network access. Keep false for shared environments after private endpoint and private DNS are configured; set true only for controlled bootstrap or rollback from an approved workstation."
  type        = bool
  default     = false
}

variable "sql_database_name" {
  description = "Azure SQL database name."
  type        = string
  default     = "bingo_db"
}

variable "sql_database_sku_name" {
  description = "Azure SQL database SKU. Basic keeps this dev environment low cost."
  type        = string
  default     = "Basic"
}

variable "sql_allowed_ip_ranges" {
  description = "Optional client IP firewall rules for running migrations from local machines. These only apply if SQL public network access is temporarily enabled."
  type = map(object({
    start_ip_address = string
    end_ip_address   = string
  }))
  default = {}
}

variable "virtual_network_address_space" {
  description = "Address space for the VNet that hosts Function App integration and SQL Private Link."
  type        = list(string)
  default     = ["10.60.0.0/16"]
}

variable "function_integration_subnet_address_prefixes" {
  description = "Subnet address prefixes delegated to Microsoft.Web/serverFarms for Function App regional VNet integration."
  type        = list(string)
  default     = ["10.60.1.0/24"]
}

variable "private_endpoint_subnet_address_prefixes" {
  description = "Subnet address prefixes for Private Endpoint resources."
  type        = list(string)
  default     = ["10.60.2.0/24"]
}

variable "function_plan_sku_name" {
  description = "App Service plan SKU for the Function App. EP1/EP2/EP3 are Functions Elastic Premium SKUs; P*v3/P*v4 are dedicated App Service SKUs for subscriptions without Elastic Premium quota."
  type        = string
  default     = "EP1"

  validation {
    condition = contains([
      "EP1",
      "EP2",
      "EP3",
      "P0v3",
      "P1v3",
      "P2v3",
      "P3v3",
      "P0v4",
      "P1v4",
      "P2v4",
      "P3v4",
    ], var.function_plan_sku_name)
    error_message = "function_plan_sku_name must be EP1, EP2, EP3, or a supported Premium v3/v4 dedicated App Service SKU such as P0v3."
  }
}

variable "function_pre_warmed_instance_count" {
  description = "Pre-warmed instance count for Elastic Premium Function plans. Ignored for dedicated App Service SKUs such as P0v3."
  type        = number
  default     = 1
}

variable "frontend_app_service_sku_name" {
  description = "App Service plan SKU for the frontend Linux Web App that hosts the built Vue assets. B1 is suitable for dev/test."
  type        = string
  default     = "B1"
}

variable "communication_data_location" {
  description = "Data location for globally scoped Azure Communication Services and Email resources."
  type        = string
  default     = "United States"
}

variable "acs_sender_username" {
  description = "ACS Email sender username for the Azure-managed domain. The resulting sender is username@domain."
  type        = string
  default     = "DoNotReply"
}

variable "acs_sender_display_name" {
  description = "Display name for the ACS Email sender username."
  type        = string
  default     = "Copilot Bingo"
}

