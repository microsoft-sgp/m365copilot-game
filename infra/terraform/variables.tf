variable "subscription_id" {
  description = "Azure subscription ID used by the AzureRM provider."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name for the app resources. Terraform will create/manage this group unless you import an existing group first."
  type        = string
  default     = "rg-m365copilot-game-dev"
}

variable "location" {
  description = "Primary Azure region for app resources."
  type        = string
  default     = "eastus2"
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
  description = "App Service plan SKU for the Function App. FC1 is Flex Consumption."
  type        = string
  default     = "FC1"
}

variable "function_maximum_instance_count" {
  description = "Maximum Flex Consumption instances for the Function App."
  type        = number
  default     = 50
}

variable "function_instance_memory_mb" {
  description = "Memory size per Flex Consumption instance."
  type        = number
  default     = 2048
}

variable "static_web_app_sku_tier" {
  description = "Static Web Apps SKU tier."
  type        = string
  default     = "Free"
}

variable "static_web_app_sku_size" {
  description = "Static Web Apps SKU size."
  type        = string
  default     = "Free"
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
