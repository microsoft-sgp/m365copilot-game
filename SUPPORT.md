# Support

Copilot Chat Bingo is shared as an open-source sample for Microsoft 365 Copilot adoption events. Unless a maintainer states otherwise, this repository is not an official Microsoft support channel and does not provide production service-level commitments.

## Getting help

- Use GitHub Issues for reproducible bugs, setup problems, and documentation gaps.
- Use the issue templates so maintainers have the environment, deployment path, logs, and screenshots needed to help.
- For Azure platform problems, use your normal Azure support plan or Microsoft support channel.
- For Microsoft 365 Copilot product questions, use your organization's Microsoft 365 support process or the relevant Microsoft documentation.

## Before opening an issue

Please check:

- Existing open and closed issues for similar reports
- [README.md](README.md) for local setup and project overview
- [DEPLOYMENT.md](DEPLOYMENT.md) and [infra/terraform/README.md](infra/terraform/README.md) for Azure deployment guidance
- Function App logs, browser console output, and database migration output for actionable errors

## Player recovery and private windows

Players can use the same email as a game player and, if authorized, as an admin. Player recovery and admin OTP are separate flows: admin OTP only signs into the portal, while player recovery only reissues a player token after the player verifies access to their game email.

If a player opens a private window, a new browser, or a cookie-restricted session, they may no longer have the `player_token` proof for an existing player email. In that case the game pauses board launch and asks for a player recovery code. After the code is verified, the backend issues a new device token and reloads the player's SQL-backed board state.

For support triage, check Function App logs for `player_recovery_request`, `player_recovery_verify`, and `admin_otp_send_attempt` events. These logs use email hashes and outcomes; they do not include raw email addresses, recovery codes, player tokens, or token hashes. If recovery or admin OTP email delivery fails, verify `ACS_CONNECTION_STRING` and `ACS_EMAIL_SENDER` before asking the user to request a new code.

When `ACS_CONNECTION_STRING` is a Function App Key Vault reference, also check the App Service Key Vault reference status. `Resolved` is healthy. `AccessToKeyVaultDenied` means the Function App cannot reach or read the vault, commonly because Key Vault public network access is disabled without a working Key Vault Private Endpoint, `privatelink.vaultcore.azure.net` Private DNS zone link, or managed identity secret `Get`/`List` permission. Function logs may also show `Invalid connection string @Microsoft.KeyVault(...)` when the unresolved reference reaches email configuration. Admin OTP and player recovery share the same email helper, so a Key Vault reference failure affects both flows.

Rollback: deploy the previous frontend first to restore the generic conflict behavior, then disable or remove the player recovery endpoints. The recovery tables are additive; existing `players.owner_token` credentials, sessions, assignments, and board state remain valid.

## Data and privacy

Deployers are responsible for their own event data handling. The app can store player names, player emails, gameplay progress, admin emails, OTP metadata, and CSV exports. Protect exports and deployment logs according to your organization's privacy, retention, and access-control policies.

## Security reports

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
