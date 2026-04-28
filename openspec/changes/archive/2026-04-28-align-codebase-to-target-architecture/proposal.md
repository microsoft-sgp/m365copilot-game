## Why

`openspec/config.yaml` now describes the intended architecture, but the implementation still reflects an earlier JavaScript/Vitest-only, bearer-token, no-cache baseline. Aligning the codebase with the target architecture will make future changes safer, improve deployment consistency, and close the gap between OpenSpec guidance and the runtime system.

## What Changes

- Migrate backend source and shared frontend logic toward strict TypeScript with build, type-check, ESLint, and Prettier enforcement.
- Add Playwright end-to-end coverage for core player and admin flows while preserving co-located Vitest unit tests for backend/frontend logic.
- Introduce Redis as the production cache layer, with local-development and failure-mode behavior that does not compromise correctness.
- Change admin/session authentication from client-stored bearer tokens to JWT access and refresh tokens delivered through httpOnly cookies.
- Update deployment, Terraform, Docker/local settings, and documentation to describe the target runtime dependencies and verification commands.
- Keep the REST API JSON contract for application payloads, except where authentication responses move token material into cookies.
- Rollback plan: ship changes behind additive configuration where possible; preserve current bearer-token and no-cache paths until the cookie auth and Redis paths are verified; rollback by disabling Redis configuration, reverting auth clients to bearer mode, and redeploying the last JavaScript-compatible build artifacts if TypeScript build issues appear.

## Capabilities

### New Capabilities

- `target-runtime-architecture`: Runtime, tooling, and deployment expectations for strict TypeScript, ESLint/Prettier, Vitest, Playwright, and target Azure service configuration.
- `runtime-cache`: Redis-backed cache behavior, fallback behavior, and invalidation expectations for API data that can be cached safely.

### Modified Capabilities

- `admin-auth`: Admin authentication shall use httpOnly JWT access and refresh cookies instead of exposing long-lived token material to browser JavaScript.

## Impact

- Affected backend code: Azure Functions handlers, shared auth/database/cache helpers, package scripts, TypeScript build configuration, tests, and generated function entry points if needed.
- Affected frontend code: API client, admin login/session handling, auth state management, Playwright test harness, and TypeScript-aware build/test configuration.
- Affected infrastructure: Terraform for Azure Managed Redis, Function App settings, Key Vault references, deployment outputs, Docker Compose/local development configuration, and CI verification commands.
- Affected documentation: README, deployment docs, Terraform docs, and contributor guidance for test/lint/type-check workflows.
- Affected teams: backend/API, frontend/admin portal, infrastructure/DevOps, QA/test automation, security reviewers, and event operations deploying the app.
