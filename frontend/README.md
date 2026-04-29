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

For a real backend during local development, start the backend from `../backend` and launch Vite with `VITE_API_BASE=http://127.0.0.1:7071/api`. The Playwright full-stack script wires this automatically when it starts Vite.

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

Run the fast browser functional suite from the frontend project:

```bash
npm run e2e
```

The fast suite starts the Vite dev server automatically and mocks API responses in Playwright, so it does not require Docker or a live backend. It covers player onboarding/gameplay, admin portal workflows, mobile grid layout, and hardening-sensitive browser contracts. Use `npm run e2e:ci` for CI-style line reporting.

Run the full-stack smoke suite only against a local backend and database:

```bash
# from the repository root, in one terminal
docker compose up --build

# from another terminal, seed a local-only admin code
E2E_ENABLE_ADMIN_OTP_SEED=1 \
ADMIN_E2E_EMAIL=admin@test.com \
ADMIN_E2E_CODE=123456 \
SQL_CONNECTION_STRING='Server=tcp:localhost,1433;Initial Catalog=bingo_db;User ID=sa;Password=BingoTest123!;Encrypt=false;TrustServerCertificate=true;' \
npm run seed:e2e-admin-otp --prefix backend

# run the gated full-stack project
E2E_BASE_URL=http://localhost:8080 \
E2E_API_BASE_URL=http://localhost:7071/api \
ADMIN_E2E_EMAIL=admin@test.com \
ADMIN_E2E_CODE=123456 \
npm run e2e:fullstack --prefix frontend
```

The full-stack suite is skipped unless `FULLSTACK_E2E=1` is set by the script. Keep it local; it creates player data and consumes the seeded admin OTP.

## Notes

- Tailwind CSS is the primary styling entry via `src/styles/tailwind.css`.
- Game logic, persistence, and verification rules live under `src/lib/` and `src/data/`.
- API calls are centralized in `src/lib/api.js`; admin routes use `/api/portal-api/*`.
- The legacy single-file implementation at the repository root remains available as a rollback target.
