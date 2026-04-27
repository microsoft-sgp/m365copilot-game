## Why

This project is moving from an internal or event-specific build toward a public open-source project that others can adopt for Microsoft 365 Copilot adoption programs. The application README and deployment guidance already explain the product, but the repository needs the community, security, support, privacy, setup, and legal framing that public users expect before they can safely trust, run, or contribute to it.

## What Changes

- Add public repository community health files for contribution guidance, code of conduct, security reporting, support expectations, pull requests, issues, and code ownership.
- Update project documentation so first-time users can choose a clear setup path, understand local development and Azure deployment prerequisites, and avoid stale player-flow instructions such as manual pack selection or Quick Pick.
- Add public-facing notices for license, Microsoft trademark/brand usage, non-warranty/support boundaries, security reporting, and deployer responsibility for privacy and player data handling.
- Include the Static Web Apps runtime config in source when required for deployment, so public users do not have to hand-create production routing files.
- Preserve the existing MIT license unless Microsoft legal guidance requires a different copyright holder or additional notices.
- Rollback plan: remove the newly added community/docs files and revert README/deployment-doc changes if the open-source release is paused; no application runtime data or database migration changes are required.

## Capabilities

### New Capabilities
- `open-source-readiness`: Repository documentation and community-health expectations for public users, contributors, maintainers, security reporters, and deployers.

### Modified Capabilities
- None.

## Impact

- Affected areas: root README, deployment documentation, Terraform documentation, frontend deployment assets, repository community files under `.github/`, and root-level legal/support/security docs.
- No backend API, frontend gameplay, database schema, authentication behavior, or Azure infrastructure behavior changes are intended.
- Affected teams: maintainers/release owners, Microsoft open-source/legal/security reviewers, event facilitators who deploy the app, and external adopters or contributors.
