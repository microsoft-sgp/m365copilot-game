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

## Data and privacy

Deployers are responsible for their own event data handling. The app can store player names, player emails, gameplay progress, admin emails, OTP metadata, and CSV exports. Protect exports and deployment logs according to your organization's privacy, retention, and access-control policies.

## Security reports

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
