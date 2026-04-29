import { expect, test, type Page } from '@playwright/test';
import {
  launchAssignedBoard,
  onboardPlayer,
  proofForAnyTile,
  readVisiblePackId,
  verifyTileByIndex,
} from './fixtures';

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:7071/api';
const adminEmail = process.env.ADMIN_E2E_EMAIL || 'admin-e2e@example.com';
const adminCode = process.env.ADMIN_E2E_CODE || '123456';
const allowedOrigin = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:5173').origin;
const adminCookieUrl = `${apiBaseUrl}/portal-api/refresh`;

test.describe('full-stack smoke', () => {
  test.skip(
    process.env.FULLSTACK_E2E !== '1',
    'Set FULLSTACK_E2E=1 to run database-backed smoke tests.',
  );
  test.describe.configure({ mode: 'serial' });

  test('real player can launch a board, claim a line, and see leaderboard activity', async ({
    page,
  }) => {
    const uniqueEmail = `player-e2e-${Date.now()}@nus.edu.sg`;

    await onboardPlayer(page, { name: 'E2E Player', email: uniqueEmail });
    await launchAssignedBoard(page);
    const packId = await readVisiblePackId(page);

    await verifyTileByIndex(page, 0, proofForAnyTile(packId, 0));
    await verifyTileByIndex(page, 1, proofForAnyTile(packId, 1));
    await verifyTileByIndex(page, 2, proofForAnyTile(packId, 2));

    await expect(page.getByText(/BINGO/i)).toBeVisible();
    await page.getByRole('button', { name: /activity/i }).click();
    await expect(page.getByText('Organization Leaderboard')).toBeVisible();
    await expect(page.getByText('NUS')).toBeVisible();
  });

  test('real admin OTP race yields one session and enforces refresh/logout origins', async ({
    page,
  }) => {
    const verifyPayload = { email: adminEmail, code: adminCode };
    const verifyResponses = await Promise.all([
      page.context().request.post(`${apiBaseUrl}/portal-api/verify-otp`, { data: verifyPayload }),
      page.context().request.post(`${apiBaseUrl}/portal-api/verify-otp`, { data: verifyPayload }),
    ]);
    const successResponses = verifyResponses.filter((response) => response.ok());
    const alreadyUsedResponses = verifyResponses.filter((response) => response.status() === 401);

    expect(successResponses).toHaveLength(1);
    expect(alreadyUsedResponses).toHaveLength(1);
    await expect(alreadyUsedResponses[0].json()).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/already used/i),
    });
    expect(alreadyUsedResponses[0].headers()['set-cookie']).toBeUndefined();

    await page.goto('/#/admin');
    await expect(page.getByText('Recent Sessions')).toBeVisible();
    await expect(page.getByText('Recent Score Events')).toBeVisible();

    const cookiesAfterLogin = await adminAuthCookies(page);
    expect(cookiesAfterLogin.some((cookie) => cookie.name === 'admin_refresh')).toBe(true);

    const missingOriginRefresh = await page
      .context()
      .request.post(`${apiBaseUrl}/portal-api/refresh`);
    expect(missingOriginRefresh.status()).toBe(403);
    expect(await adminAuthCookies(page)).toEqual(cookiesAfterLogin);

    const forbiddenOriginRefresh = await page
      .context()
      .request.post(`${apiBaseUrl}/portal-api/refresh`, {
        headers: { Origin: 'https://evil.example.com' },
      });
    expect(forbiddenOriginRefresh.status()).toBe(403);
    expect(await adminAuthCookies(page)).toEqual(cookiesAfterLogin);

    const allowedRefresh = await page.context().request.post(`${apiBaseUrl}/portal-api/refresh`, {
      headers: { Origin: allowedOrigin },
    });
    expect(allowedRefresh.ok()).toBe(true);
    const cookiesAfterAllowedRefresh = await adminAuthCookies(page);
    expect(cookiesAfterAllowedRefresh.some((cookie) => cookie.name === 'admin_access')).toBe(true);
    expect(cookiesAfterAllowedRefresh.some((cookie) => cookie.name === 'admin_refresh')).toBe(true);

    const missingOriginLogout = await page
      .context()
      .request.post(`${apiBaseUrl}/portal-api/logout`);
    expect(missingOriginLogout.status()).toBe(403);
    expect(await adminAuthCookies(page)).toEqual(cookiesAfterAllowedRefresh);

    const forbiddenOriginLogout = await page
      .context()
      .request.post(`${apiBaseUrl}/portal-api/logout`, {
        headers: { Origin: 'https://evil.example.com' },
      });
    expect(forbiddenOriginLogout.status()).toBe(403);
    expect(await adminAuthCookies(page)).toEqual(cookiesAfterAllowedRefresh);

    const allowedLogout = await page.context().request.post(`${apiBaseUrl}/portal-api/logout`, {
      headers: { Origin: allowedOrigin },
    });
    expect(allowedLogout.ok()).toBe(true);
    expect(await adminAuthCookies(page)).toEqual([]);
  });

  test('real hardening endpoints enforce POST body and admin Origin boundaries', async ({
    request,
  }) => {
    const stateResponse = await request.post(`${apiBaseUrl}/player/state`, {
      data: { email: 'unknown-fullstack@example.com' },
    });
    expect(stateResponse.ok()).toBe(true);
    await expect(stateResponse.json()).resolves.toMatchObject({ ok: true, player: null });

    const leakedQueryResponse = await request.get(
      `${apiBaseUrl}/player/state?email=unknown-fullstack@example.com`,
    );
    expect([404, 405]).toContain(leakedQueryResponse.status());
  });
});

async function adminAuthCookies(page: Page) {
  const cookies = await page.context().cookies(adminCookieUrl);
  return cookies
    .filter((cookie) => ['admin_access', 'admin_refresh', 'admin_step_up'].includes(cookie.name))
    .map((cookie) => ({ name: cookie.name, value: cookie.value }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
