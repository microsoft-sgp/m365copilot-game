import { expect, test } from '@playwright/test';
import { expectNoAdminTokenStorage, mockApi } from './fixtures';

test('admin can log in with OTP, load dashboard with credentials, log out, and be rejected after logout', async ({
  context,
  page,
}) => {
  const api = await mockApi(page);

  await page.goto('/#/admin/login');
  await page.getByRole('button', { name: /send code/i }).click();
  await expect(page.getByText('Please enter a valid email.')).toBeVisible();
  await page.getByPlaceholder('admin@example.com').fill('admin@test.com');
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByRole('button', { name: /verify & login/i }).click();
  await expect(page.getByText('Please enter the 6-digit code.')).toBeVisible();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: /verify & login/i }).click();

  await expect(page.getByText('Admin Portal')).toBeVisible();
  await expect(page.getByText('Recent Sessions')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'NUS' }).first()).toBeVisible();
  await expect.poll(() => api.dashboardRequestsWithCookie).toBeGreaterThan(0);

  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === 'admin_access' && cookie.httpOnly)).toBe(true);
  await expectNoAdminTokenStorage(page);

  await page.getByRole('button', { name: /logout/i }).click();
  await expect(page.getByRole('button', { name: /admin login/i })).toBeVisible();

  await page.goto('/#/admin');
  await expect(page.getByText('Admin Login')).toBeVisible();
  await expect(page.getByText('Admin Portal')).toBeHidden();
  await expect.poll(() => api.refreshRequests).toBeGreaterThan(0);
});
