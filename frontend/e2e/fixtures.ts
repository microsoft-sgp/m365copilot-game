import type { Page, Request, Route } from '@playwright/test';

export type MockApiState = {
  dashboardRequestsWithCookie: number;
  refreshRequests: number;
  loggedOut: boolean;
  events: unknown[];
  // Captures the X-Player-Token header on every call after createSession so
  // tests can assert the SPA threads the token through subsequent requests.
  playerTokenHeaders: Array<{ method: string; path: string; token: string }>;
};

const now = new Date('2026-04-26T12:00:00.000Z').toISOString();

export async function mockApi(page: Page): Promise<MockApiState> {
  const state: MockApiState = {
    dashboardRequestsWithCookie: 0,
    refreshRequests: 0,
    loggedOut: false,
    events: [],
    playerTokenHeaders: [],
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    // Capture the X-Player-Token header on every game-API call (everything
    // outside the admin portal) so tests can verify the SPA forwards the
    // token issued by /api/sessions on subsequent calls.
    if (!path.startsWith('/api/portal-api/')) {
      const headerToken = request.headers()['x-player-token'] || '';
      state.playerTokenHeaders.push({ method, path, token: headerToken });
    }

    if (method === 'GET' && path === '/api/player/state') {
      return json(route, { player: null });
    }

    if (method === 'POST' && path === '/api/sessions') {
      return json(route, {
        ok: true,
        gameSessionId: 101,
        packId: 1,
        // Static fixture token so tests can assert exact equality on the
        // X-Player-Token header forwarded with later calls.
        playerToken: 'e2e-fixture-player-token',
        activeAssignment: {
          packId: 1,
          cycleNumber: 1,
          rotated: false,
          completedPackId: null,
        },
      });
    }

    if (method === 'POST' && path === '/api/events') {
      state.events.push(readJsonBody(request));
      return json(route, { ok: true });
    }

    if (method === 'PATCH' && path.startsWith('/api/sessions/')) {
      return json(route, { ok: true });
    }

    if (method === 'GET' && path === '/api/leaderboard') {
      return json(route, {
        leaderboard: [{ org: 'NUS', score: 1, contributors: 1, lastSubmission: now }],
      });
    }

    if (method === 'GET' && path === '/api/organizations/domains') {
      return json(route, { domains: { 'nus.edu.sg': 'NUS' } });
    }

    if (method === 'POST' && path === '/api/portal-api/request-otp') {
      return json(route, {
        ok: true,
        message: 'If this email is authorised, a code has been sent.',
      });
    }

    if (method === 'POST' && path === '/api/portal-api/verify-otp') {
      const body = readJsonBody(request);
      const cookieName = body?.purpose === 'admin-management' ? 'admin_step_up' : 'admin_access';
      return json(route, { ok: true }, 200, {
        'set-cookie': `${cookieName}=mock-${cookieName}; Path=/api/portal-api; HttpOnly; SameSite=Lax`,
      });
    }

    if (method === 'POST' && path === '/api/portal-api/refresh') {
      state.refreshRequests += 1;
      const cookie = request.headers().cookie || '';
      if (state.loggedOut || !cookie.includes('admin_refresh')) {
        return json(route, { ok: false, message: 'Unauthorized' }, 401);
      }
      return json(route, { ok: true }, 200, {
        'set-cookie':
          'admin_access=mock-admin_access; Path=/api/portal-api; HttpOnly; SameSite=Lax',
      });
    }

    if (method === 'POST' && path === '/api/portal-api/logout') {
      state.loggedOut = true;
      return json(route, { ok: true }, 200, {
        'set-cookie': 'admin_access=; Path=/api/portal-api; Max-Age=0; HttpOnly; SameSite=Lax',
      });
    }

    if (method === 'GET' && path === '/api/portal-api/dashboard') {
      const cookie = request.headers().cookie || '';
      if (!cookie.includes('admin_access')) {
        return json(route, { ok: false, message: 'Unauthorized' }, 401);
      }
      state.dashboardRequestsWithCookie += 1;
      return json(route, {
        summary: {
          totalPlayers: 12,
          totalSessions: 18,
          totalSubmissions: 7,
          avgTilesCleared: 4,
          topOrg: 'NUS',
        },
        sessions: [
          {
            id: 101,
            player_name: 'Ada',
            pack_id: 1,
            tiles_cleared: 3,
            lines_won: 1,
            last_active_at: now,
          },
        ],
        submissions: [
          {
            id: 501,
            player_name: 'Ada',
            org: 'NUS',
            event_type: 'line_won',
            keyword: 'CO-APR26-001-R1-MOCK',
            created_at: now,
          },
        ],
      });
    }

    if (path.startsWith('/api/portal-api/')) {
      return json(route, { ok: true });
    }

    return json(route, { ok: false, message: `Unhandled mock route: ${method} ${path}` }, 404);
  });

  return state;
}

export function proofForBrainstormList(): string {
  return [
    'VERIFY-APR26-001-0',
    '1. Solar sprint',
    '2. Carbon counter',
    '3. Circular campus',
    '4. Waste watcher',
    '5. Green commute',
    '6. Energy buddy',
    '7. Reuse marketplace',
    '8. Climate stories',
  ].join('\n');
}

export function proofForWorkshopAgenda(): string {
  return [
    'VERIFY-APR26-001-1',
    '| Time | Session | Facilitator |',
    '| --- | --- | --- |',
    '| 09:00 | Welcome | Host |',
    '| 09:30 | Skills map | Coach |',
    '| 10:15 | Lab one | Mentor |',
    '| 11:00 | Breakout | Lead |',
    '| 11:45 | Showcase | Panel |',
    '| 12:30 | Wrap | Host |',
  ].join('\n');
}

export function proofForStudyPlan(): string {
  return [
    'VERIFY-APR26-001-2',
    '| Day | Topic | Activity |',
    '| --- | --- | --- |',
    '| 1 | Syntax | Read examples |',
    '| 2 | Variables | Build notes |',
    '| 3 | Loops | Solve drills |',
    '| 4 | Functions | Refactor code |',
    '| 5 | Review | Mini project |',
  ].join('\n');
}

function readJsonBody(request: Request): Record<string, unknown> | null {
  try {
    return request.postDataJSON() as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function json(
  route: Route,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  });
}
