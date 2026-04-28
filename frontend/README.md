# Copilot Chat Bingo — Frontend

Vue 3 + Tailwind CSS (v4) frontend for the Copilot Chat Bingo game.

![Copilot Chat Bingo application UI](../docs/images/app-ui.svg)

## Screens

- Player identity gate stores the player's name and email before board setup.
- Game tab shows the assigned pack, weekly challenge progress, HUD counters, and the 3x3 task board.
- Keywords tab lists earned line keywords and handles leaderboard submission.
- Activity tab shows leaderboard and player progress history.
- Admin route (`#/admin/login`) uses OTP login before showing dashboard, organizations, campaigns, players, admin access, and danger-zone views.

## Develop

```bash
npm ci
npm run dev
```

The dev server expects the backend API at `http://localhost:7071/api` through Vite proxy configuration. Start the backend from `../backend` with `npm start`, or use the root Docker Compose workflow for the full stack.

## Build

```bash
npm run typecheck
npm run build
npm run preview
```

## Verify

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
```

Run browser smoke tests from the frontend project:

```bash
npm run e2e
```

The smoke suite starts the Vite dev server automatically and mocks API responses in Playwright, so it does not require Docker or a live backend. Use `npm run e2e:ci` for CI-style line reporting. For a full-stack manual browser pass, start the root Docker Compose stack or the backend dev server separately and exercise the same flows against the real API.

## Notes

- Tailwind CSS is the primary styling entry via `src/styles/tailwind.css`.
- Game logic, persistence, and verification rules live under `src/lib/` and `src/data/`.
- API calls are centralized in `src/lib/api.js`; admin routes use `/api/portal-api/*`.
- The legacy single-file implementation at the repository root remains available as a rollback target.
