import { expect, test } from '@playwright/test';
import {
  launchAssignedBoard,
  mockApi,
  onboardPlayer,
  proofForBrainstormList,
  verifyTileByTitle,
} from './fixtures';

test('player onboarding validates required fields and public organization input', async ({
  page,
}) => {
  const api = await mockApi(page);

  await page.goto('/');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Please enter how we should address you.')).toBeVisible();

  await page.getByPlaceholder('e.g. Alex').fill('Taylor');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Please enter your email.')).toBeVisible();

  await page.getByPlaceholder('you@university.edu.sg').fill('not-an-email');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();

  await page.getByPlaceholder('you@university.edu.sg').fill('taylor@gmail.com');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Please enter your company, school, or organization.')).toBeVisible();

  await page.getByPlaceholder('e.g. Contoso').fill('Contoso');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Start Your Board')).toBeVisible();

  await expect.poll(() => api.createSessionRequests.length).toBeGreaterThan(0);
  expect(api.createSessionRequests[0].body).toMatchObject({
    playerName: 'Taylor',
    email: 'taylor@gmail.com',
    organization: 'Contoso',
  });
});

test('known university email can enter without manual organization', async ({ page }) => {
  const api = await mockApi(page);

  await onboardPlayer(page, { name: 'Ada', email: 'ada@nus.edu.sg' });
  await expect(page.getByText('Start Your Board')).toBeVisible();
  await expect.poll(() => api.createSessionRequests.length).toBeGreaterThan(0);
  expect(api.createSessionRequests[0].body).toMatchObject({
    playerName: 'Ada',
    email: 'ada@nus.edu.sg',
  });
  expect(api.createSessionRequests[0].body).not.toHaveProperty('organization');
});

test('stale player token triggers one session refresh and retries game call', async ({ page }) => {
  const api = await mockApi(page, { unauthorizedOnce: ['POST /api/events'] });

  await onboardPlayer(page, { name: 'Ada', email: 'ada@nus.edu.sg' });
  await launchAssignedBoard(page);
  await verifyTileByTitle(page, 'Brainstorm List', proofForBrainstormList());

  await expect.poll(() => api.events.length).toBeGreaterThan(0);
  expect(
    api.calls.filter((call) => call.method === 'POST' && call.path === '/api/events'),
  ).toHaveLength(2);
  expect(api.events).toHaveLength(1);
  expect(api.playerTokenHeaders.filter((call) => call.path === '/api/events').at(-1)?.token).toBe(
    'e2e-fixture-player-token',
  );
});
