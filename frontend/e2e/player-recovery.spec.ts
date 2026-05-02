import { expect, test } from '@playwright/test';
import { mockApi, onboardPlayer } from './fixtures';

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
  await expect(page.getByText(/ada@nus\.edu\.sg/)).toBeVisible();
  await expect(page.getByText('Brainstorm List')).toHaveCount(0);

  await page.getByRole('button', { name: /send code/i }).click();
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