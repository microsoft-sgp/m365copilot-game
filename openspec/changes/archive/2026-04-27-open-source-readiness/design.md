## Context

Copilot Chat Bingo is becoming a public open-source project for organizations and facilitators who want to run Microsoft 365 Copilot adoption events. The codebase already has a clear product README, a Docker Compose local path, Azure deployment notes, Terraform infrastructure, and a standard MIT license. However, the repository lacks the community-health and maintainer-facing files that public GitHub projects usually need: contribution guidance, code of conduct, support boundaries, security reporting, issue templates, pull request template, and code ownership.

The repository also has some public-launch documentation drift. The README now describes server-assigned packs, while deployment verification still references manual pack picking and Quick Pick. The deployment docs also ask users to create a Static Web Apps fallback config manually instead of shipping that deploy-time file with the frontend source.

Stakeholders include external adopters, event facilitators, contributors, maintainers/release owners, and Microsoft open-source, legal, and security reviewers.

## Goals / Non-Goals

**Goals:**

- Make the repository understandable and trustworthy for first-time public users.
- Add GitHub-recognized community health files for contributions, conduct, security reporting, support, issue intake, pull requests, and ownership.
- Align setup and deployment documentation with the current server-assigned pack flow and Terraform-backed deployment path.
- Make deployer responsibilities explicit for secrets, privacy, player names/emails, exports, support, and Microsoft trademark use.
- Keep the existing MIT license in place unless Microsoft legal review requires a copyright-holder or notice change.

**Non-Goals:**

- No runtime behavior changes to the player game, admin portal, backend API, database schema, authentication flow, or Azure infrastructure resources.
- No new package dependencies.
- No replacement of the OpenSpec workflow or archived change history.
- No formal privacy policy authored on behalf of Microsoft; the repository should instead state deployer responsibilities and point to appropriate organizational review.

## Decisions

### Use GitHub community health conventions

Create root-level or `.github/` files that GitHub automatically surfaces: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`, and `.github/CODEOWNERS`.

Rationale: These files are the standard path used by public GitHub projects and are recognized directly in GitHub's community profile and issue/PR flows.

Alternative considered: Place all guidance in the README only. Rejected because it makes the README heavier and does not activate GitHub's built-in contribution, support, and template affordances.

### Reference Microsoft public policies where appropriate

Use Microsoft Open Source Code of Conduct language or a concise file that adopts it. Route vulnerability reports through Microsoft Security Response Center guidance rather than public issues. Add trademark and support wording that clarifies Microsoft marks and sample/support boundaries.

Rationale: The project uses Microsoft 365 Copilot context and Microsoft ownership signals, so public users need clear Microsoft-compatible conduct, security, and legal direction.

Alternative considered: Use generic Contributor Covenant and generic security mailbox text. Rejected because Microsoft-managed repositories commonly use Microsoft-specific Code of Conduct and MSRC reporting paths.

### Treat privacy and data handling as deployer-facing responsibilities

Document that deployments collect player names, emails, game progress, admin emails, OTP metadata, and CSV exports. State that deployers are responsible for consent, retention, access control, export handling, and compliance for their organization or event.

Rationale: The app is deployable by many organizations and cannot ship a single universal privacy policy. A clear data-handling notice reduces accidental misuse while avoiding claims that the repository cannot guarantee.

Alternative considered: Add a full privacy policy for all users. Rejected because the policy depends on who deploys the app, where it runs, and which attendees participate.

### Keep implementation scoped to repository readiness

Do not alter backend functions, frontend game behavior, database migrations, or Terraform resources except for adding deploy-time static frontend configuration if missing.

Rationale: Public launch readiness is mostly docs and repository metadata. Keeping runtime behavior unchanged reduces regression risk and makes review easier.

Alternative considered: Combine this with broader security hardening or auth redesign. Rejected because that would expand scope beyond open-source packaging.

## Risks / Trade-offs

- [Risk] Legal wording may not match Microsoft open-source release requirements. -> Mitigation: use conservative notices, preserve the existing MIT license, and flag copyright/trademark/support wording for Microsoft legal review.
- [Risk] Security reporting guidance could be wrong for the final GitHub organization. -> Mitigation: use Microsoft MSRC guidance if the repo is Microsoft-owned; otherwise leave a clear placeholder for maintainers to confirm before release.
- [Risk] Documentation may imply official Microsoft support for a sample app. -> Mitigation: add SUPPORT guidance that separates community issues from Microsoft commercial support channels.
- [Risk] Public users may deploy with real player data without appropriate privacy review. -> Mitigation: add data-handling notes in README/SUPPORT/DEPLOYMENT and mention CSV exports and admin access responsibilities.
- [Risk] CODEOWNERS cannot work until real GitHub users or teams are known. -> Mitigation: add a placeholder or owner pattern that maintainers must replace before enabling branch protection.

## Migration Plan

1. Add community health files and templates.
2. Update README links so users can find contributing, security, support, data-handling, legal, and license information from the landing page.
3. Align deployment documentation with server-assigned packs and current Terraform/static hosting expectations.
4. Add `frontend/public/staticwebapp.config.json` if the frontend still requires a Static Web Apps SPA fallback at deploy time.
5. Run documentation and config checks: markdown link sanity where practical, `git diff --check`, stale Quick Pick/manual pack wording scan, and secret-pattern scan over public docs.
6. Roll back by deleting added community files and reverting documentation/config changes; no runtime or database rollback is required.

## Open Questions

- Should the copyright line remain `Microsoft Singapore`, or should it be changed to `Microsoft Corporation` before public release?
- Which GitHub organization/team should own `.github/CODEOWNERS` entries?
- Should support direct users to GitHub Issues only, GitHub Discussions, an internal Microsoft contact, or a specific adoption-program channel?
- Is this repository intended to accept outside code contributions immediately, or should `CONTRIBUTING.md` state that issues and docs feedback are welcome while feature PRs require maintainer approval first?
