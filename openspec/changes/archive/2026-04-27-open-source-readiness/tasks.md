## 1. Community Health Files

- [x] 1.1 Add `CONTRIBUTING.md` with contribution scope, local setup, test commands, issue/PR expectations, Microsoft CLA guidance, and AI-assisted contribution disclosure guidance.
- [x] 1.2 Add `CODE_OF_CONDUCT.md` adopting the Microsoft Open Source Code of Conduct and linking to the Microsoft FAQ/reporting contact.
- [x] 1.3 Add `SECURITY.md` instructing reporters not to open public security issues and directing them to the Microsoft-approved vulnerability reporting path.
- [x] 1.4 Add `SUPPORT.md` clarifying community support channels, unsupported scenarios, and separation from official Microsoft commercial support.
- [x] 1.5 Add `.github/CODEOWNERS` with maintainer placeholders or confirmed GitHub teams and comments explaining what must be finalized before branch protection.

## 2. Issue And Pull Request Intake

- [x] 2.1 Add bug report issue template collecting environment, setup path, reproduction steps, expected behavior, actual behavior, logs/screenshots, and data-safety confirmation.
- [x] 2.2 Add feature request issue template collecting problem, proposed outcome, alternatives, event/adoption context, and implementation willingness.
- [x] 2.3 Add documentation/setup issue template for README, deployment, Terraform, local Docker, and Azure setup feedback.
- [x] 2.4 Add issue template config that disables or discourages blank public issues and routes security reports to `SECURITY.md`.
- [x] 2.5 Add pull request template with change summary, linked issue/change, test evidence, docs impact, data/security impact, and contributor checklist.

## 3. README And Public Notices

- [x] 3.1 Update `README.md` to link to contributing, code of conduct, security, support, deployment, and license guidance from the landing page.
- [x] 3.2 Add a data-handling section describing stored player names, emails, gameplay progress, admin emails, OTP metadata, and CSV export responsibilities.
- [x] 3.3 Add legal/trademark wording for Microsoft, Microsoft 365, and Copilot marks while preserving the existing MIT license reference.
- [x] 3.4 Add support-boundary wording that describes the repository as a sample/community project unless maintainers confirm a different support model.
- [x] 3.5 Add a release-review note or TODO for maintainers to confirm the `LICENSE` copyright holder before public release.

## 4. Setup And Deployment Documentation

- [x] 4.1 Remove stale current-flow references to manual pack picking and Quick Pick from deployment verification docs.
- [x] 4.2 Clarify the recommended deployment path and relationship between the manual Azure CLI guide and the Terraform guide.
- [x] 4.3 Update `DEPLOYMENT.md` and `infra/terraform/README.md` to consistently mention server-assigned packs, managed secrets, ACS Email, and deployer data responsibilities.
- [x] 4.4 Add `frontend/public/staticwebapp.config.json` if Static Web Apps still requires the SPA fallback config at build/deploy time.
- [x] 4.5 Ensure local-only sample credentials and placeholders are clearly labeled as local-only or non-production values.

## 5. Verification

- [x] 5.1 Run `git diff --check` across changed documentation and config files.
- [x] 5.2 Run a stale-term scan for `Quick Pick`, `Quick pick`, and `pick a pack` in public docs and resolve current-flow mismatches.
- [x] 5.3 Run a public-doc secret-pattern scan for connection strings, access keys, deployment tokens, tenant/subscription identifiers, and real production URLs.
- [x] 5.4 Verify Markdown links for new root and `.github` documentation where practical.
- [x] 5.5 Run `openspec status --change "open-source-readiness"` and confirm all required artifacts remain complete.
