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
npm install
npm run dev
```

The dev server expects the backend API at `http://localhost:7071/api` through Vite proxy configuration. Start the backend from `../backend` with `func start`, or use the root Docker Compose workflow for the full stack.

## Build

```bash
npm run build
npm run preview
```

## Notes

- Tailwind CSS is the primary styling entry via `src/styles/tailwind.css`.
- Game logic, persistence, and verification rules live under `src/lib/` and `src/data/`.
- API calls are centralized in `src/lib/api.js`; admin routes use `/api/portal-api/*`.
- The legacy single-file implementation at the repository root remains available as a rollback target.
