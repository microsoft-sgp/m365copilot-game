import { expect, test } from '@playwright/test';
import {
  expectNoAdminTokenStorage,
  mockApi,
  onboardPlayer,
  seedMockAdminRefreshCookie,
} from './fixtures';

test('player state lookup uses POST body contract without email query leakage', async ({
  page,
}) => {
  const api = await mockApi(page);

  await onboardPlayer(page, { name: 'Ada', email: 'ada@nus.edu.sg' });

  await expect.poll(() => api.playerStateRequests.length).toBe(1);
  const stateRequest = api.playerStateRequests[0];
  expect(stateRequest.method).toBe('POST');
  expect(stateRequest.path).toBe('/api/player/state');
  expect(new URL(stateRequest.url).search).toBe('');
  expect(stateRequest.body).toEqual({ email: 'ada@nus.edu.sg' });
});

test('admin route refresh relies on httpOnly cookie without token storage', async ({
  context,
  page,
}) => {
  const api = await mockApi(page);
  await seedMockAdminRefreshCookie(context);

  await page.goto('/#/admin');

  await expect(page.getByText('Admin Portal')).toBeVisible();
  await expect.poll(() => api.refreshRequests).toBe(1);
  await expect.poll(() => api.dashboardRequestsWithCookie).toBeGreaterThan(0);
  await expectNoAdminTokenStorage(page);
});
