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

test('admin returns to login when dashboard cannot confirm cookie-backed session after OTP', async ({
  page,
}) => {
  await mockApi(page, {
    overrides: [
      async ({ method, path, route }) => {
        if (method === 'GET' && path === '/api/portal-api/dashboard') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, message: 'Unauthorized' }),
          });
          return true;
        }
        return false;
      },
    ],
  });

  await page.goto('/#/admin/login');
  await page.getByPlaceholder('admin@example.com').fill('admin@test.com');
  await page.getByRole('button', { name: /send code/i }).click();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: /verify & login/i }).click();

  await expect(page.getByText('Your admin session could not be confirmed')).toBeVisible();
  await expect(page.getByText('Admin Login')).toBeVisible();
  await expect(page.getByText('Failed to load dashboard')).toBeHidden();
  await expect(page.evaluate(() => sessionStorage.getItem('admin_authenticated'))).resolves.toBeNull();
});

test('stored admin marker is cleared when protected admin data returns unauthorized', async ({ page }) => {
  await mockApi(page, {
    overrides: [
      async ({ method, path, route }) => {
        if (method === 'GET' && path === '/api/portal-api/dashboard') {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, message: 'Unauthorized' }),
          });
          return true;
        }
        return false;
      },
    ],
  });

  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('admin_authenticated', 'true');
    sessionStorage.setItem('admin_email', 'admin@test.com');
  });
  await page.goto('/#/admin');

  await expect(page.getByText('Your admin session could not be confirmed')).toBeVisible();
  await expect(page.getByText('Admin Login')).toBeVisible();
  await expect(page.getByText('Recent Sessions')).toBeHidden();
  await expect(page.evaluate(() => sessionStorage.getItem('admin_authenticated'))).resolves.toBeNull();
  await expect(page.evaluate(() => sessionStorage.getItem('admin_email'))).resolves.toBeNull();
});
