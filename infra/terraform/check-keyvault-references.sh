#!/usr/bin/env bash
set -euo pipefail

tf_dir="${TF_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
subscription_id="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
resource_group_name="${RESOURCE_GROUP_NAME:-$(terraform -chdir="${tf_dir}" output -raw resource_group_name)}"
function_app_name="${FUNCTION_APP_NAME:-$(terraform -chdir="${tf_dir}" output -raw function_app_name)}"
api_version="${AZURE_WEB_APP_CONFIG_REFERENCES_API_VERSION:-2022-03-01}"

if [[ "$#" -gt 0 ]]; then
  settings=("$@")
else
  settings=(ACS_CONNECTION_STRING ADMIN_KEY JWT_SECRET REDIS_CONNECTION_STRING)
fi

failed=0
printf "%-28s %s\n" "SETTING" "STATUS"
printf "%-28s %s\n" "-------" "------"

for setting_name in "${settings[@]}"; do
  reference_url="https://management.azure.com/subscriptions/${subscription_id}/resourceGroups/${resource_group_name}/providers/Microsoft.Web/sites/${function_app_name}/config/configreferences/appsettings/${setting_name}?api-version=${api_version}"
  status_value="$(az rest --method get --url "${reference_url}" --query properties.status -o tsv)"
  printf "%-28s %s\n" "${setting_name}" "${status_value}"
  if [[ "${status_value}" != "Resolved" ]]; then
    failed=1
  fi
done

exit "${failed}"