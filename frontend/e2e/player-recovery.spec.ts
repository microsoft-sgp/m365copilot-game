import { expect, test } from '@playwright/test';
import { mockApi, onboardPlayer } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

test('fresh browser context recovers an existing player and hydrates server board state', async ({
  page,
}) => {
  let recovered = false;
  const api = await mockApi(page, {
    overrides: [
      async ({ route, method, path }) => {
        if (method === 'POST' && path === '/api/player/state') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              player: recovered
                ? {
                    playerName: 'Ada',
                    activeAssignment: { packId: 1, cycleNumber: 1 },
                    activeSession: {
                      gameSessionId: 101,
                      packId: 1,
                      boardState: {
                        cleared: [true, false, false, false, false, false, false, false, false],
                        wonLines: [],
                        keywords: [],
                        challengeProfile: {
                          challengeStartAt: Date.now(),
                          currentWeek: 1,
                          weeksCompleted: 0,
                          weeklySubmissions: [],
                        },
                      },
                    },
                  }
                : null,
            }),
          });
          return true;
        }

        if (method === 'POST' && path === '/api/sessions' && !recovered) {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              code: 'PLAYER_RECOVERY_REQUIRED',
              message: 'Identity in use',
            }),
          });
          return true;
        }

        if (method === 'POST' && path === '/api/player/recovery/request') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
          return true;
        }

        if (method === 'POST' && path === '/api/player/recovery/verify') {
          recovered = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, playerToken: 'recovered-player-token' }),
          });
          return true;
        }

        if (method === 'POST' && path === '/api/sessions' && recovered) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              gameSessionId: 101,
              packId: 1,
              playerToken: 'recovered-player-token',
              activeAssignment: {
                packId: 1,
                cycleNumber: 1,
                rotated: false,
                completedPackId: null,
              },
            }),
          });
          return true;
        }

        return false;
      },
    ],
  });

  await onboardPlayer(page, { name: 'Ada', email: 'ada@nus.edu.sg' });
  await expect(page.getByText('Start Your Board')).toBeVisible();

  await expect(page.getByText('Player Recovery')).toBeVisible();
  await expect(page.getByText('Recover your board')).toBeVisible();
  await expect(page.getByText(/ada@nus\.edu\.sg/)).toBeVisible();
  const sendRecoveryCode = page.getByRole('button', { name: /send recovery code/i });
  const useDifferentEmail = page.getByRole('button', { name: /use different email/i });
  await expect(sendRecoveryCode).toHaveClass(/btn-primary/);
  await expect(useDifferentEmail).toHaveClass(/btn-ghost/);
  await expect(page.getByRole('button', { name: /launch board/i })).toBeDisabled();
  await expect(page.getByText('Brainstorm List')).toHaveCount(0);

  await sendRecoveryCode.click();
  await expect(page.getByText('Enter recovery code')).toBeVisible();
  await expect(page.getByRole('button', { name: /verify code/i })).toHaveClass(/btn-primary/);
  await expect(page.getByRole('button', { name: /send again/i })).toHaveClass(/btn-ghost/);
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: /verify code/i }).click();

  await expect(page.getByText('Pack #001')).toBeVisible();
  await expect(page.getByText('Brainstorm List')).toBeVisible();
  await expect(page.locator('.tile.cleared')).toHaveCount(1);
  expect(
    api.playerTokenHeaders.some(
      (call) => call.path === '/api/sessions' && call.token === 'recovered-player-token',
    ),
  ).toBeTruthy();
});
