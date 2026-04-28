## 1. Tooling Foundation

- [x] 1.1 Refresh backend and frontend package lockfiles so `npm ci` succeeds without lockfile mutation.
- [x] 1.2 Add TypeScript, ESLint, Prettier, Vue TypeScript support, and Playwright dependencies and scripts to the relevant package manifests.
- [x] 1.3 Add backend and frontend TypeScript configurations with strict compiler settings and source/output paths that fit Azure Functions and Vite.
- [x] 1.4 Add shared ESLint and Prettier configuration plus package scripts for `lint`, `format:check`, and type-checking.
- [x] 1.5 Add or update setup documentation for clean install, type-check, lint, format-check, Vitest, and Playwright commands.

## 2. TypeScript Migration

- [x] 2.1 Migrate backend shared helpers to TypeScript in small groups, preserving existing exports and co-located Vitest coverage.
- [x] 2.2 Migrate Azure Functions handlers to TypeScript while preserving route names, auth levels, JSON response shapes, and tests.
- [x] 2.3 Update backend entry points, build output, Dockerfile, local startup, and Azure Functions configuration to run compiled TypeScript output.
- [x] 2.4 Migrate frontend API, auth, storage, verification, pack-generation, and composable logic to TypeScript where it participates in target architecture behavior.
- [x] 2.5 Add or update co-located Vitest unit tests for migrated backend/frontend logic and run the relevant `npm test` commands before marking migrated areas complete.

## 3. Redis Runtime Cache

- [x] 3.1 Add a backend Redis cache abstraction with typed get/set/delete helpers, TTL support, JSON serialization, safe logging, and no-op fallback when Redis is not configured.
- [x] 3.2 Add co-located Vitest tests for cache hit, miss, serialization, TTL, and Redis failure fallback behavior.
- [x] 3.3 Wire cache-aside reads for active campaign config, organization domain map, and leaderboard responses while keeping Azure SQL authoritative.
- [x] 3.4 Invalidate affected cache keys after campaign, organization/domain, leaderboard, score-bearing event, revocation, clear, and reset mutations.
- [x] 3.5 Run backend `npm test` after cache wiring and verify endpoints still return correct JSON when Redis is absent or failing.

## 4. Cookie-Based Admin Auth

- [x] 4.1 Add cookie parsing/setting helpers for access, refresh, and step-up cookies with environment-aware `HttpOnly`, `Secure`, `SameSite`, path, and expiry attributes.
- [x] 4.2 Update OTP verification to set access/refresh httpOnly cookies and stop returning JWT token strings in JSON responses.
- [x] 4.3 Add refresh and logout endpoints that rotate or clear admin cookies without exposing refresh token material to browser JavaScript.
- [x] 4.4 Update admin authentication middleware to accept JWT access cookies and retain `x-admin-key` as a break-glass path.
- [x] 4.5 Update step-up OTP verification and admin-management mutations to use a short-lived httpOnly step-up proof or equivalent server-validated proof.
- [x] 4.6 Update frontend admin API calls to use credentialed requests, remove JWT `sessionStorage`/`localStorage` token handling, and keep only non-sensitive UI state client-side.
- [x] 4.7 Add or update co-located Vitest tests for cookie issuance, refresh rejection, logout clearing, admin endpoint auth, step-up proof, and frontend credentialed request behavior.
- [x] 4.8 Run backend and frontend `npm test` after auth changes before marking the auth track complete.

## 5. Infrastructure And Deployment

- [x] 5.1 Add Terraform resources and variables for Azure Managed Redis, secure Redis settings, and Function App configuration needed by the cache layer.
- [x] 5.2 Add or update Key Vault/app setting references for JWT secrets, Redis credentials, allowed origins, cookie settings, and local-development equivalents.
- [x] 5.3 Update Docker Compose or local setup docs to describe optional local Redis and no-Redis fallback behavior.
- [x] 5.4 Update deployment documentation with Redis provisioning, auth cookie/CORS settings, rollback guidance, and post-deploy verification steps.
- [x] 5.5 Validate Terraform formatting and planning behavior for the updated infrastructure files without committing secrets or generated plans.

## 6. Playwright End-to-End Coverage

- [x] 6.1 Add Playwright configuration, test fixtures, and scripts for local and CI smoke runs.
- [x] 6.2 Add a player-flow smoke test covering onboarding, assigned pack startup, tile verification, persisted state, and leaderboard or activity visibility.
- [x] 6.3 Add an admin-flow smoke test covering OTP login with deterministic test delivery, authenticated dashboard access, credentialed API requests, logout, and rejection after logout or expiry.
- [x] 6.4 Document the required local services or Docker Compose path for running Playwright reliably.

## 7. Final Verification

- [x] 7.1 Run backend `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`.
- [x] 7.2 Run frontend `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`.
- [x] 7.3 Run the Playwright smoke suite and capture any required environment notes.
- [x] 7.4 Run `openspec validate align-codebase-to-target-architecture --strict` and resolve any spec/task drift.
- [x] 7.5 Review rollback paths for TypeScript build, Redis disablement, and cookie-auth fallback before marking implementation complete.
