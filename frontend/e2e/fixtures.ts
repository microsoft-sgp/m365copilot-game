import { expect, type BrowserContext, type Page, type Request, type Route } from '@playwright/test';

export type CapturedApiCall = {
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
};

export type MockApiState = {
  dashboardRequestsWithCookie: number;
  refreshRequests: number;
  loggedOut: boolean;
  events: Array<Record<string, unknown> | null>;
  sessionUpdates: Array<Record<string, unknown> | null>;
  submissions: Array<Record<string, unknown> | null>;
  calls: CapturedApiCall[];
  playerTokenHeaders: Array<{ method: string; path: string; token: string }>;
  playerStateRequests: CapturedApiCall[];
  createSessionRequests: CapturedApiCall[];
  rerollRequests: CapturedApiCall[];
  adminMutations: CapturedApiCall[];
};

export type MockRouteContext = {
  route: Route;
  request: Request;
  url: URL;
  path: string;
  method: string;
  state: MockApiState;
  body: Record<string, unknown> | null;
};

type MockApiOptions = {
  playerState?: Record<string, unknown> | null;
  unauthorizedOnce?: string[];
  overrides?: Array<(ctx: MockRouteContext) => Promise<boolean> | boolean>;
};

const now = new Date('2026-04-26T12:00:00.000Z').toISOString();

const defaultDashboard = {
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
};

export async function mockApi(page: Page, options: MockApiOptions = {}): Promise<MockApiState> {
  const state: MockApiState = {
    dashboardRequestsWithCookie: 0,
    refreshRequests: 0,
    loggedOut: false,
    events: [],
    sessionUpdates: [],
    submissions: [],
    calls: [],
    playerTokenHeaders: [],
    playerStateRequests: [],
    createSessionRequests: [],
    rerollRequests: [],
    adminMutations: [],
  };

  const unauthorizedOnce = new Set(options.unauthorizedOnce || []);
  const organizations = [{ id: 1, name: 'NUS', domains: [{ id: 11, domain: 'nus.edu.sg' }] }];
  const campaigns = [
    {
      id: 'APR26',
      displayName: 'April 2026',
      totalPacks: 999,
      totalWeeks: 7,
      copilotUrl: 'https://m365.cloud.microsoft/chat',
      isActive: true,
      stats: { totalPlayers: 12, totalSessions: 18, totalSubmissions: 7 },
    },
  ];
  const admins = [
    { email: 'admin@test.com', source: 'bootstrap', isActive: true },
    { email: 'ops@test.com', source: 'portal', isActive: true },
  ];
  const players = [
    {
      id: 3,
      player_name: 'Ada',
      email: 'ada@nus.edu.sg',
      session_count: 2,
      submission_count: 1,
    },
  ];
  const playerDetail = {
    player: players[0],
    sessions: [
      {
        id: 8,
        pack_id: 1,
        tiles_cleared: 3,
        lines_won: 1,
        keywords_earned: 2,
        last_active_at: now,
      },
    ],
    submissions: [
      {
        id: 9,
        org: 'NUS',
        keyword: 'CO-APR26-001-R1-MOCK',
        created_at: now,
      },
    ],
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = readJsonBody(request);
    const call: CapturedApiCall = {
      method,
      path,
      url: request.url(),
      headers: request.headers(),
      body,
    };
    state.calls.push(call);

    if (!path.startsWith('/api/portal-api/')) {
      const headerToken = request.headers()['x-player-token'] || '';
      state.playerTokenHeaders.push({ method, path, token: headerToken });
    }

    for (const override of options.overrides || []) {
      if (await override({ route, request, url, path, method, state, body })) return;
    }

    if (shouldRejectOnce(unauthorizedOnce, method, path)) {
      return json(route, { ok: false, message: 'Unauthorized' }, 401);
    }

    if (method === 'POST' && path === '/api/player/state') {
      state.playerStateRequests.push(call);
      return json(route, { ok: true, player: options.playerState ?? null });
    }

    if (method === 'POST' && path === '/api/sessions') {
      state.createSessionRequests.push(call);
      return json(route, {
        ok: true,
        gameSessionId: 101,
        packId: 1,
        playerToken: 'e2e-fixture-player-token',
        activeAssignment: {
          packId: 1,
          cycleNumber: 1,
          rotated: false,
          completedPackId: null,
        },
      });
    }

    if (method === 'POST' && path === '/api/player/assignment/reroll') {
      state.rerollRequests.push(call);
      return json(route, {
        ok: true,
        gameSessionId: 202,
        packId: 2,
        activeAssignment: {
          assignmentId: 2020,
          packId: 2,
          cycleNumber: 2,
          rerolled: true,
          abandonedAssignment: { assignmentId: 1010, packId: 1, status: 'abandoned' },
        },
      });
    }

    if (method === 'POST' && path === '/api/events') {
      state.events.push(body);
      return json(route, { ok: true });
    }

    if (method === 'PATCH' && path.startsWith('/api/sessions/')) {
      state.sessionUpdates.push(body);
      return json(route, { ok: true });
    }

    if (method === 'POST' && path === '/api/submissions') {
      state.submissions.push(body);
      return json(route, { ok: true, orgDupe: false });
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
      return json(route, defaultDashboard);
    }

    if (method === 'GET' && path === '/api/portal-api/export') {
      return route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: 'org,score\nNUS,1\n',
      });
    }

    if (path === '/api/portal-api/organizations') {
      if (method === 'GET') return json(route, { organizations });
      if (method === 'POST') {
        state.adminMutations.push(call);
        const name = String(body?.name || '').trim();
        if (name.toLowerCase() === 'duplicate') {
          return json(route, { ok: false, message: 'Organization already exists' }, 409);
        }
        organizations.push({ id: organizations.length + 1, name, domains: [] });
        return json(route, { ok: true });
      }
    }

    const orgMatch = path.match(/^\/api\/portal-api\/organizations\/(\d+)$/);
    if (orgMatch) {
      state.adminMutations.push(call);
      const orgId = Number(orgMatch[1]);
      const org = organizations.find((item) => item.id === orgId);
      if (method === 'PUT' && org) {
        org.name = String(body?.name || org.name);
        return json(route, { ok: true });
      }
      if (method === 'DELETE') {
        return json(route, { ok: true });
      }
    }

    const domainAddMatch = path.match(/^\/api\/portal-api\/organizations\/(\d+)\/domains$/);
    if (method === 'POST' && domainAddMatch) {
      state.adminMutations.push(call);
      const orgId = Number(domainAddMatch[1]);
      const org = organizations.find((item) => item.id === orgId);
      org?.domains.push({ id: Date.now(), domain: String(body?.domain || '') });
      return json(route, { ok: true });
    }

    const domainRemoveMatch = path.match(
      /^\/api\/portal-api\/organizations\/(\d+)\/domains\/(\d+)$/,
    );
    if (method === 'DELETE' && domainRemoveMatch) {
      state.adminMutations.push(call);
      return json(route, { ok: true });
    }

    if (path === '/api/portal-api/campaigns') {
      if (method === 'GET') return json(route, { campaigns });
      if (method === 'POST') {
        state.adminMutations.push(call);
        if (String(body?.id || '').toUpperCase() === 'DUPLICATE') {
          return json(route, { ok: false, message: 'Campaign already exists' }, 409);
        }
        campaigns.push({
          id: String(body?.id || 'NEW'),
          displayName: String(body?.displayName || 'New Campaign'),
          totalPacks: Number(body?.totalPacks || 999),
          totalWeeks: Number(body?.totalWeeks || 7),
          copilotUrl: String(body?.copilotUrl || 'https://m365.cloud.microsoft/chat'),
          isActive: false,
          stats: { totalPlayers: 0, totalSessions: 0, totalSubmissions: 0 },
        });
        return json(route, { ok: true });
      }
    }

    const campaignSettingsMatch = path.match(/^\/api\/portal-api\/campaigns\/([^/]+)\/settings$/);
    if (method === 'PUT' && campaignSettingsMatch) {
      state.adminMutations.push(call);
      const campaign = campaigns.find((item) => item.id === campaignSettingsMatch[1]);
      if (campaign && body) Object.assign(campaign, body);
      return json(route, { ok: true });
    }

    const campaignClearMatch = path.match(/^\/api\/portal-api\/campaigns\/([^/]+)\/clear$/);
    if (method === 'POST' && campaignClearMatch) {
      state.adminMutations.push(call);
      if (campaignClearMatch[1] === 'FAIL')
        return json(route, { ok: false, message: 'denied' }, 500);
      return json(route, { ok: true, deleted: { sessions: 2, events: 3, submissions: 4 } });
    }

    const leaderboardResetMatch = path.match(
      /^\/api\/portal-api\/campaigns\/([^/]+)\/reset-leaderboard$/,
    );
    if (method === 'POST' && leaderboardResetMatch) {
      state.adminMutations.push(call);
      if (leaderboardResetMatch[1] === 'FAIL') {
        return json(route, { ok: false, message: 'reset denied' }, 500);
      }
      return json(route, { ok: true, deleted: { submissions: 4 } });
    }

    if (method === 'GET' && path === '/api/portal-api/players') {
      return json(route, { players });
    }

    if (method === 'GET' && path === '/api/portal-api/players/3') {
      return json(route, playerDetail);
    }

    if (method === 'DELETE' && path === '/api/portal-api/players/3') {
      state.adminMutations.push(call);
      return json(route, { ok: true });
    }

    if (method === 'DELETE' && path === '/api/portal-api/submissions/9') {
      state.adminMutations.push(call);
      return json(route, { ok: true });
    }

    if (path === '/api/portal-api/admins') {
      if (method === 'GET') return json(route, { admins });
      if (method === 'POST') {
        state.adminMutations.push(call);
        admins.push({ email: String(body?.email || ''), source: 'portal', isActive: true });
        return json(route, { ok: true });
      }
    }

    if (method === 'DELETE' && path.startsWith('/api/portal-api/admins/')) {
      state.adminMutations.push(call);
      return json(route, { ok: true });
    }

    if (path.startsWith('/api/portal-api/')) {
      return json(route, { ok: true });
    }

    return json(route, { ok: false, message: `Unhandled mock route: ${method} ${path}` }, 404);
  });

  return state;
}

export async function onboardPlayer(
  page: Page,
  identity: { name?: string; email?: string; organization?: string } = {},
) {
  await page.goto('/');
  if (identity.name !== undefined) {
    await page.getByPlaceholder('e.g. Alex').fill(identity.name);
  }
  if (identity.email !== undefined) {
    await page.getByPlaceholder('you@university.edu.sg').fill(identity.email);
  }
  if (identity.organization !== undefined) {
    await page.getByPlaceholder('e.g. Contoso').fill(identity.organization);
  }
  await page.getByRole('button', { name: /continue/i }).click();
}

export async function launchAssignedBoard(page: Page) {
  await expect(page.getByText('Start Your Board')).toBeVisible();
  await page.getByRole('button', { name: /launch board/i }).click();
  await expect(page.getByText(/Pack #\d{3}/)).toBeVisible();
}

export async function verifyTileByTitle(page: Page, title: string, proof: string) {
  await closeBottomOverlay(page);
  await page.getByText(title, { exact: true }).click();
  await page.locator('textarea').fill(proof);
  await page.getByRole('button', { name: /verify & claim/i }).click();
}

export async function verifyTileByIndex(page: Page, tileIndex: number, proof: string) {
  await closeBottomOverlay(page);
  await page.locator('.tile').nth(tileIndex).click();
  await page.locator('textarea').fill(proof);
  await page.getByRole('button', { name: /verify & claim/i }).click();
}

export async function loginAsAdmin(page: Page, email = 'admin@test.com', code = '123456') {
  await page.goto('/#/admin/login');
  await page.getByPlaceholder('admin@example.com').fill(email);
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByPlaceholder('000000').fill(code);
  await page.getByRole('button', { name: /verify & login/i }).click();
  await expect(page.getByText('Admin Portal')).toBeVisible();
}

export async function seedMockAdminRefreshCookie(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'admin_refresh',
      value: 'mock-admin_refresh',
      domain: '127.0.0.1',
      path: '/api/portal-api',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'admin_refresh',
      value: 'mock-admin_refresh',
      domain: 'localhost',
      path: '/api/portal-api',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

export async function expectNoAdminTokenStorage(page: Page) {
  await expect(page.evaluate(() => sessionStorage.getItem('admin_token'))).resolves.toBeNull();
  await expect(page.evaluate(() => localStorage.getItem('admin_token'))).resolves.toBeNull();
}

export async function clickAdminTab(page: Page, label: RegExp | string) {
  await page.getByRole('button', { name: label }).click();
}

export async function withConfirm(page: Page, accept: boolean, action: () => Promise<unknown>) {
  page.once('dialog', async (dialog) => {
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
  await action();
}

export async function readVisiblePackId(page: Page): Promise<number> {
  const text = await page
    .getByText(/Pack #\d{3}/)
    .first()
    .textContent();
  const match = text?.match(/Pack #(\d{3})/);
  return Number(match?.[1] || 1);
}

export function proofForAnyTile(packId: number, tileIndex: number): string {
  const marker = `VERIFY-APR26-${String(packId).padStart(3, '0')}-${tileIndex}`;
  return [
    `SINGAPORE, April 2025 — This launch note is ready.`,
    marker,
    '',
    '• Benefit one',
    '• Benefit two',
    '• Benefit three',
    '',
    ...Array.from({ length: 8 }, (_, i) => `${i + 1}. Question ${i + 1}?`),
    '→ supporting action',
    '',
    '## Strengths',
    '## Weaknesses',
    '## Opportunities',
    '## Threats',
    '## Insight 1',
    '## Insight 2',
    '## Insight 3',
    '## Introduction',
    '## Main Activity',
    '## Wrap-Up',
    '## What Went Well',
    '## What I Learned',
    "## What I'll Do Differently",
    '',
    '| A | B | C | D | E |',
    '| --- | --- | --- | --- | --- |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '| 1 | 2 | 3 | 4 | 5 |',
    '',
    '**Alpha** explains the first idea.',
    '',
    '**Beta** explains the second idea.',
    '',
    '**Gamma** explains the third idea.',
    '',
    'Yours sincerely,',
    'Subject: Project update',
    'Objective: Improve the club semester.',
    'Action: Follow up tomorrow.',
    'Q: One?',
    'A: Answer one.',
    'Q: Two?',
    'A: Answer two.',
    'Q: Three?',
    'A: Answer three.',
    'Q: Four?',
    'A: Answer four.',
    'Q: Five?',
    'A: Answer five.',
    '#one #two #three',
    '{ "name": "Ada", "university": "NUS", "course": "CS", "year": "2", "skills": ["a", "b", "c"] }',
  ].join('\n');
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

function shouldRejectOnce(unauthorizedOnce: Set<string>, method: string, path: string): boolean {
  const keys = [`${method} ${path}`, path];
  for (const key of keys) {
    if (unauthorizedOnce.has(key)) {
      unauthorizedOnce.delete(key);
      return true;
    }
  }
  return false;
}

async function closeBottomOverlay(page: Page) {
  await page
    .locator('.fixed.bottom-6 button')
    .click({ timeout: 500 })
    .catch(() => {});
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
