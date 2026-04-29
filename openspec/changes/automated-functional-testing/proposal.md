## Why

The application has grown beyond the current thin Playwright happy paths, and recent admin/session hardening changes make regressions in cookies, OTP, Origin checks, and player state synchronization more likely to slip through manual smoke testing. Automated functional coverage is needed now to validate the full player and admin experience after hardening and before future deployment changes.

## What Changes

- Add Playwright functional regression coverage for the complete player journey: onboarding validation, assigned pack startup, tile verification, line win feedback, keyword/activity views, persistence, token forwarding, and responsive board behavior.
- Add Playwright coverage for the admin portal: OTP login, cookie-backed session handling, dashboard, CSV export, organizations, campaigns, player management, admin access step-up, danger-zone confirmations, refresh, and logout.
- Add hardening-focused API/browser contract tests that verify `POST /api/player/state` never carries email in the URL, admin refresh/logout enforce allowed Origins, admin tokens remain out of browser storage, and OTP replay/race behavior does not issue duplicate sessions.
- Organize tests into fast mocked SPA suites, API contract suites, and an optional full-stack Docker Compose smoke suite so CI can run deterministic checks while maintainers can run deeper local validation when needed.
- Extend Playwright fixtures/helpers to support reusable API mocks, request capture, admin session setup, confirmation dialog handling, and unique test data.
- Document how to run the fast suite and the optional full-stack smoke suite.
- **No runtime product behavior changes** are intended; this change adds automated coverage and supporting test harness code.

## Capabilities

### New Capabilities
- `automated-functional-testing`: Defines automated Playwright coverage for player, admin, hardening, and full-stack smoke workflows.

### Modified Capabilities
<!-- none -->

## Impact

- **Code**: [frontend/e2e/](frontend/e2e/) Playwright specs and fixtures, [frontend/playwright.config.ts](frontend/playwright.config.ts), [frontend/package.json](frontend/package.json), and documentation in [README.md](README.md) or a focused testing guide.
- **APIs**: No API contract changes. Tests will assert the contracts already defined by existing and active OpenSpec changes, especially admin session hardening and player-state privacy.
- **Dependencies**: No new runtime dependencies expected. Test-only dependencies should be avoided unless Playwright cannot reasonably cover full-stack setup with the existing toolchain.
- **Systems**: Fast suites run against mocked API routes through Vite. Optional full-stack smoke runs against the local Docker Compose stack using Azure SQL Edge, Redis, backend, and built frontend.
- **Affected teams**: Frontend, backend, security reviewers, release/ops maintainers, and contributors who run validation before PRs.
- **Rollback**: Revert the added Playwright specs, fixtures, scripts, and docs. Because no runtime application code or database schema changes are planned, rollback does not require migrations, secret rotation, or infrastructure changes.