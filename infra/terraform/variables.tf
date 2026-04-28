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
  description = "Primary Azure region for app resources. Korea Central is the default. Azure Communication Services intentionally uses a different region (see communication_data_location)."
  type        = string
  default     = "koreacentral"
}

variable "resource_group_location" {
  description = "Azure region metadata for the resource group. Use the existing resource group's location when deploying into one."
  type        = string
  default     = "koreacentral"
}

variable "sql_location" {
  description = "Azure region for Azure SQL resources. This can differ from app resources when SQL provisioning is restricted in the app region."
  type        = string
  default     = "koreacentral"
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
  description = "Azure Cache for Redis SKU name used by the API cache layer."
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.redis_sku_name)
    error_message = "redis_sku_name must be Basic, Standard, or Premium."
  }
}

variable "redis_family" {
  description = "Azure Cache for Redis SKU family. Use C for Basic/Standard and P for Premium."
  type        = string
  default     = "C"
}

variable "redis_capacity" {
  description = "Azure Cache for Redis capacity. Basic/Standard C0 is suitable for dev/test."
  type        = number
  default     = 0
}

variable "redis_version" {
  description = "Redis engine version requested for the managed cache."
  type        = string
  default     = "6"
}

variable "redis_maxmemory_policy" {
  description = "Redis eviction policy for cache-aside entries."
  type        = string
  default     = "allkeys-lru"
}

variable "redis_public_network_access_enabled" {
  description = "Whether the Redis cache allows public network access. Keep false only when private networking is configured."
  type        = bool
  default     = true
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
  description = "Optional client IP firewall rules for running migrations from local machines. Azure services are allowed separately."
  type = map(object({
    start_ip_address = string
    end_ip_address   = string
  }))
  default = {}
}

variable "function_plan_sku_name" {
  description = "App Service plan SKU for the Function App. EP1/EP2/EP3 are Functions Elastic Premium SKUs."
  type        = string
  default     = "EP1"

  validation {
    condition     = contains(["EP1", "EP2", "EP3"], var.function_plan_sku_name)
    error_message = "function_plan_sku_name must be an Elastic Premium SKU (EP1, EP2, or EP3)."
  }
}

variable "function_pre_warmed_instance_count" {
  description = "Pre-warmed instance count for the Functions Premium plan. Keep at least 1 to mitigate cold starts."
  type        = number
  default     = 1
}

variable "frontend_app_service_sku_name" {
  description = "App Service plan SKU for the frontend Linux Web App that hosts the built Vue assets. B1 is suitable for dev/test."
  type        = string
  default     = "B1"
}

variable "communication_data_location" {
  description = "Data location for Azure Communication Services and Email resources."
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

# ---------------------------------------------------------------------------
# Application Gateway WAF v2
# ---------------------------------------------------------------------------

variable "enable_waf" {
  description = "Whether to deploy an Application Gateway WAF v2 in front of the frontend App Service."
  type        = bool
  default     = true
}

variable "waf_mode" {
  description = "WAF policy mode. Use Detection while tuning rules, Prevention to actively block matched traffic."
  type        = string
  default     = "Prevention"

  validation {
    condition     = contains(["Detection", "Prevention"], var.waf_mode)
    error_message = "waf_mode must be Detection or Prevention."
  }
}

variable "appgw_vnet_address_space" {
  description = "CIDR block for the VNet that hosts the Application Gateway subnet."
  type        = string
  default     = "10.10.0.0/16"
}

variable "appgw_subnet_address_prefix" {
  description = "CIDR block for the Application Gateway subnet. Must be at least /24 for WAF_v2."
  type        = string
  default     = "10.10.1.0/24"
}

variable "appgw_min_capacity" {
  description = "Minimum number of Application Gateway WAF v2 instances kept warm."
  type        = number
  default     = 1
}

variable "appgw_max_capacity" {
  description = "Maximum number of Application Gateway WAF v2 instances autoscale can grow to."
  type        = number
  default     = 3
}

variable "appgw_availability_zones" {
  description = "Availability zones for the Application Gateway and its public IP. Set to [] to disable zone redundancy."
  type        = list(string)
  default     = []
}
