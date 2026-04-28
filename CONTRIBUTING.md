# Contributing to Copilot Chat Bingo

Thank you for your interest in improving Copilot Chat Bingo. This project is intended to help organizations and facilitators run Microsoft 365 Copilot adoption activities, so clear setup notes, deployment fixes, accessibility improvements, and safe operational guidance are especially valuable.

## Ways to contribute

- Report reproducible bugs with environment details and logs.
- Suggest improvements for adoption-event workflows, admin operations, deployment, or documentation.
- Improve setup, deployment, troubleshooting, and accessibility documentation.
- Submit focused pull requests that are linked to an issue or OpenSpec change.

For larger behavior changes, please start with an issue or OpenSpec proposal before opening a pull request. That keeps product scope, data handling, and deployment impact visible before implementation begins.

## Local development

Prerequisites:

- Node.js 20.x or later and npm 10.x
- Docker Desktop for the full local stack
- Azure Functions Core Tools v4 for direct backend debugging

Fastest full-stack path:

```bash
docker compose up --build
```

Manual development path:

```bash
docker compose up db db-init
cd backend
npm ci
npm start
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The local Docker Compose credentials and sample admin email are development-only. Do not reuse local values in shared, staging, or production deployments.

## Tests

Run the backend and frontend verification commands before submitting a pull request:

```bash
cd backend
npm ci
npm run typecheck
npm run build
npm run lint
npm run format:check
npm test

cd ../frontend
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
```

When your change affects browser-visible player or admin behavior, also run the Playwright smoke suite from the frontend project. It starts Vite automatically and uses mocked API fixtures for deterministic smoke coverage:

```bash
cd frontend
npm run e2e
```

For full-stack browser checks against Azure SQL and the Functions API, start the root Docker Compose stack or the backend/frontend dev servers manually and repeat the same player and admin journeys.

For documentation-only changes, describe the review you performed, such as link checks, stale-term scans, or command examples checked for accuracy.

## Pull requests

Pull requests should:

- Keep changes focused and easy to review.
- Include tests or explain why tests are not needed.
- Update docs when setup, deployment, security, data handling, or user-visible behavior changes.
- Avoid committing secrets, Terraform state, publish profiles, local settings, deployment tokens, or generated plans.
- Call out any data, privacy, or security impact in the PR description.

## Microsoft Contributor License Agreement

Most Microsoft open-source projects require contributors to complete a Contributor License Agreement (CLA). If this repository is configured with the Microsoft CLA bot, follow the bot instructions on your pull request. By contributing, you represent that you have the right to submit your contribution and that it can be used under this project's license.

## AI-assisted contributions

AI tools may be used to help draft code, tests, or documentation, but contributors are responsible for the final submission. Review AI-assisted changes carefully for accuracy, licensing concerns, privacy issues, and security impact. If AI assistance materially shaped the pull request, disclose that in the PR description.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security issues

Do not report security vulnerabilities through public GitHub issues. Follow [SECURITY.md](SECURITY.md) instead.
