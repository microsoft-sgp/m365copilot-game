import { expect, test, type Dialog } from '@playwright/test';
import { clickAdminTab, loginAsAdmin, mockApi, withConfirm } from './fixtures';

test('admin dashboard shows aggregate data and exports CSV', async ({ page }) => {
  await mockApi(page);
  await loginAsAdmin(page);

  await expect(page.getByText('Recent Sessions')).toBeVisible();
  await expect(page.getByText('Recent Score Events')).toBeVisible();
  await expect(page.getByText('Top Org:')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export csv/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('progression-scores.csv');
});

test('admin can create, edit, and delete organizations and domains', async ({ page }) => {
  const api = await mockApi(page);
  await loginAsAdmin(page);
  await clickAdminTab(page, /organizations/i);

  await expect(page.getByText('nus.edu.sg')).toBeVisible();
  await page.getByPlaceholder('New organization name').fill('Contoso');
  await page.getByRole('button', { name: '+ Add' }).click();
  await expect
    .poll(() => api.adminMutations.some((call) => call.path === '/api/portal-api/organizations'))
    .toBe(true);
  await expect(page.getByText('Contoso')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByRole('textbox').nth(1).fill('NUS Enterprise');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => api.adminMutations.some((call) => call.method === 'PUT')).toBe(true);

  await page.getByPlaceholder('add domain').first().fill('enterprise.example');
  await page.getByRole('button', { name: '+', exact: true }).first().click();
  await expect
    .poll(() => api.adminMutations.some((call) => call.path.endsWith('/domains')))
    .toBe(true);

  const domainDeleteCount = api.adminMutations.filter(
    (call) => call.method === 'DELETE' && call.path.includes('/domains/'),
  ).length;
  await page.getByRole('button', { name: '✕' }).first().click();
  await expect
    .poll(
      () =>
        api.adminMutations.filter(
          (call) => call.method === 'DELETE' && call.path.includes('/domains/'),
        ).length,
    )
    .toBeGreaterThan(domainDeleteCount);

  await withConfirm(page, false, () =>
    page.getByRole('button', { name: 'Delete' }).first().click(),
  );
  expect(
    api.adminMutations.filter(
      (call) =>
        call.method === 'DELETE' && /^\/api\/portal-api\/organizations\/\d+$/.test(call.path),
    ).length,
  ).toBe(0);
  await withConfirm(page, true, () => page.getByRole('button', { name: 'Delete' }).first().click());
  await expect
    .poll(() =>
      api.adminMutations.some(
        (call) =>
          call.method === 'DELETE' && /^\/api\/portal-api\/organizations\/\d+$/.test(call.path),
      ),
    )
    .toBe(true);
});

test('admin organization duplicate errors are visible', async ({ page }) => {
  await mockApi(page);
  await loginAsAdmin(page);
  await clickAdminTab(page, /organizations/i);

  await page.getByPlaceholder('New organization name').fill('Duplicate');
  await page.getByRole('button', { name: '+ Add' }).click();
  await expect(page.getByText('Organization already exists')).toBeVisible();
});

test('admin can create and update campaign settings', async ({ page }) => {
  const api = await mockApi(page);
  await loginAsAdmin(page);
  await clickAdminTab(page, /campaigns/i);

  await expect(page.getByText('APR26')).toBeVisible();
  await page.getByRole('button', { name: /new campaign/i }).click();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Campaign already exists');
    await dialog.accept();
  });
  await page.getByPlaceholder('e.g. JUL26').fill('DUPLICATE');
  await page.getByPlaceholder('e.g. July 2026').fill('Duplicate Campaign');
  await page.getByRole('button', { name: 'Create' }).click();

  await page.getByPlaceholder('e.g. JUL26').fill('JUL26');
  await page.getByPlaceholder('e.g. July 2026').fill('July 2026');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect
    .poll(() =>
      api.adminMutations.some(
        (call) => call.method === 'POST' && call.path === '/api/portal-api/campaigns',
      ),
    )
    .toBe(true);
  await expect(page.getByText('JUL26')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('APR26')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.locator('input').first().fill('April 2026 Sprint');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() =>
      api.adminMutations.some(
        (call) => call.method === 'PUT' && call.path.includes('/campaigns/APR26/settings'),
      ),
    )
    .toBe(true);

  await page
    .getByRole('button', { name: /deactivate|activate/i })
    .first()
    .click();
  await expect
    .poll(
      () =>
        api.adminMutations.filter(
          (call) => call.method === 'PUT' && call.path.includes('/campaigns/APR26/settings'),
        ).length,
    )
    .toBeGreaterThan(1);
});

test('admin can search player detail and revoke/delete with confirmations', async ({ page }) => {
  const api = await mockApi(page);
  await loginAsAdmin(page);
  await clickAdminTab(page, /players/i);

  await page.getByRole('button', { name: 'Search' }).click();
  expect(api.calls.filter((call) => call.path === '/api/portal-api/players')).toHaveLength(0);

  await page.getByPlaceholder('Search by email or name').fill('ada');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('cell', { name: 'ada@nus.edu.sg' })).toBeVisible();
  await page.getByRole('cell', { name: 'Ada', exact: true }).click();
  await expect(page.getByText('Game Sessions')).toBeVisible();
  await expect(page.getByText('CO-APR26-001-R1-MOCK')).toBeVisible();

  await withConfirm(page, false, () => page.getByRole('button', { name: 'Revoke' }).click());
  expect(api.adminMutations.some((call) => call.path === '/api/portal-api/submissions/9')).toBe(
    false,
  );

  const detailLoadCount = api.calls.filter(
    (call) => call.path === '/api/portal-api/players/3',
  ).length;
  await withConfirm(page, true, () => page.getByRole('button', { name: 'Revoke' }).click());
  await expect
    .poll(() => api.adminMutations.some((call) => call.path === '/api/portal-api/submissions/9'))
    .toBe(true);
  await expect
    .poll(() => api.calls.filter((call) => call.path === '/api/portal-api/players/3').length)
    .toBeGreaterThan(detailLoadCount);

  await withConfirm(page, false, () => page.getByRole('button', { name: 'Delete Player' }).click());
  expect(
    api.adminMutations.filter((call) => call.path === '/api/portal-api/players/3').length,
  ).toBe(0);
  await withConfirm(page, true, () => page.getByRole('button', { name: 'Delete Player' }).click());
  await expect
    .poll(() => api.adminMutations.some((call) => call.path === '/api/portal-api/players/3'))
    .toBe(true);
});

test('admin management requires step-up OTP before mutation', async ({ page }) => {
  const api = await mockApi(page);
  await loginAsAdmin(page);
  await clickAdminTab(page, /admins/i);
  await expect(page.getByText('admin@test.com')).toBeVisible();
  await expect(page.getByText('ops@test.com')).toBeVisible();

  await page.getByPlaceholder('admin@example.com').fill('cancelled@test.com');
  await page.getByRole('button', { name: 'Add Admin' }).click();
  await expect(page.getByText('Re-enter OTP')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Re-enter OTP')).toBeHidden();
  expect(api.adminMutations.some((call) => call.body?.email === 'cancelled@test.com')).toBe(false);

  await page.getByPlaceholder('admin@example.com').fill('newadmin@test.com');
  await page.getByRole('button', { name: 'Add Admin' }).click();
  await expect(page.getByText('Re-enter OTP')).toBeVisible();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect
    .poll(() =>
      api.adminMutations.some(
        (call) => call.method === 'POST' && call.path === '/api/portal-api/admins',
      ),
    )
    .toBe(true);
  await expect(page.getByText('newadmin@test.com')).toBeVisible();

  await page.getByRole('button', { name: 'Disable' }).first().click();
  await expect(page.getByText('Re-enter OTP')).toBeVisible();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect
    .poll(() =>
      api.adminMutations.some(
        (call) => call.method === 'DELETE' && call.path.startsWith('/api/portal-api/admins/'),
      ),
    )
    .toBe(true);
});

test('failed admin step-up OTP blocks admin mutation', async ({ page }) => {
  const api = await mockApi(page, {
    overrides: [
      async ({ body, method, path, route }) => {
        if (
          method === 'POST' &&
          path === '/api/portal-api/verify-otp' &&
          body?.purpose === 'admin-management'
        ) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, message: 'Verification failed.' }),
          });
          return true;
        }
        return false;
      },
    ],
  });
  await loginAsAdmin(page);
  await clickAdminTab(page, /admins/i);

  await page.getByPlaceholder('admin@example.com').fill('blocked@test.com');
  await page.getByRole('button', { name: 'Add Admin' }).click();
  await page.getByPlaceholder('000000').fill('999999');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Verification failed.')).toBeVisible();
  expect(api.adminMutations.some((call) => call.body?.email === 'blocked@test.com')).toBe(false);
});

test('danger zone requires phrases and confirmations for destructive actions', async ({ page }) => {
  const api = await mockApi(page);
  await loginAsAdmin(page);
  await clickAdminTab(page, /danger zone/i);

  await withConfirm(page, true, () => page.getByRole('button', { name: 'Clear All Data' }).click());
  expect(api.adminMutations.some((call) => call.path.endsWith('/clear'))).toBe(false);

  await page.getByPlaceholder('Type CLEAR-ALL').fill('CLEAR-ALL');
  await withConfirm(page, false, () =>
    page.getByRole('button', { name: 'Clear All Data' }).click(),
  );
  expect(api.adminMutations.some((call) => call.path.endsWith('/clear'))).toBe(false);

  await withConfirm(page, true, () => page.getByRole('button', { name: 'Clear All Data' }).click());
  await expect(page.getByText(/Cleared: 2 sessions/)).toBeVisible();
  await expect
    .poll(() => api.adminMutations.some((call) => call.path.endsWith('/clear')))
    .toBe(true);

  const clearFailureMessages: string[] = [];
  const clearFailureHandler = async (dialog: Dialog) => {
    clearFailureMessages.push(dialog.message());
    await dialog.accept();
  };
  page.on('dialog', clearFailureHandler);
  await page.getByPlaceholder('Campaign ID').first().fill('FAIL');
  await page.getByPlaceholder('Type CLEAR-ALL').fill('CLEAR-ALL');
  await page.getByRole('button', { name: 'Clear All Data' }).click();
  await expect.poll(() => clearFailureMessages.length).toBeGreaterThanOrEqual(2);
  page.off('dialog', clearFailureHandler);
  expect(clearFailureMessages.at(-1)).toBe('denied');

  await page.getByPlaceholder('Campaign ID').last().fill('APR26');
  await page.getByPlaceholder('Type RESET-BOARD').fill('RESET-BOARD');
  await withConfirm(page, true, () =>
    page.getByRole('button', { name: 'Reset Leaderboard' }).click(),
  );
  await expect(page.getByText(/Deleted: 4 submissions/)).toBeVisible();

  await page.getByPlaceholder('Campaign ID').last().fill('FAIL');
  await page.getByPlaceholder('Type RESET-BOARD').fill('RESET-BOARD');
  const dialogMessages: string[] = [];
  const dialogHandler = async (dialog: Dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  };
  page.on('dialog', dialogHandler);
  await page.getByRole('button', { name: 'Reset Leaderboard' }).click();
  await expect.poll(() => dialogMessages.length).toBeGreaterThanOrEqual(2);
  page.off('dialog', dialogHandler);
  expect(dialogMessages.at(-1)).toBe('reset denied');
});
