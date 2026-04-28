import { expect, type Page, test } from '@playwright/test';
import {
  mockApi,
  proofForBrainstormList,
  proofForStudyPlan,
  proofForWorkshopAgenda,
} from './fixtures';

test('player can onboard, start an assigned pack, clear a line, and see activity', async ({
  page,
}) => {
  const api = await mockApi(page);

  await page.goto('/');
  await page.getByPlaceholder('e.g. Alex').fill('Ada');
  await page.getByPlaceholder('you@university.edu.sg').fill('ada@nus.edu.sg');
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page.getByText('Start Your Board')).toBeVisible();
  await page.getByRole('button', { name: /launch board/i }).click();
  await expect(page.getByText('Pack #001')).toBeVisible();
  await expect(page.getByText('Brainstorm List')).toBeVisible();

  await verifyTile(page, 'Brainstorm List', proofForBrainstormList());
  await verifyTile(page, 'Workshop Agenda', proofForWorkshopAgenda());
  await verifyTile(page, 'Study Plan Generator', proofForStudyPlan());

  await expect(page.getByText(/BINGO! Row 1/)).toBeVisible();
  await expect(page.getByText(/CO-APR26-001-R1-/).first()).toBeVisible();
  await page.getByRole('button', { name: /keep playing/i }).click();

  await expect(page.locator('.tile.cleared')).toHaveCount(3);
  await expect(api.events.some((event) => event?.eventType === 'line_won')).toBeTruthy();

  await page.reload();
  await expect(page.getByText('Pack #001')).toBeVisible();
  await expect(page.locator('.tile.cleared')).toHaveCount(3);

  await page.getByRole('button', { name: /activity/i }).click();
  await expect(page.getByText('Organization Leaderboard')).toBeVisible();
  await expect(page.getByText('NUS')).toBeVisible();
  await expect(page.locator('.font-mono', { hasText: /CO-APR26-001-R1-/ }).last()).toBeVisible();
});

async function verifyTile(page: Page, title: string, proof: string) {
  await page
    .locator('.fixed.bottom-6 button')
    .click({ timeout: 500 })
    .catch(() => {});
  await page.getByText(title, { exact: true }).click();
  await page.locator('textarea').fill(proof);
  await page.getByRole('button', { name: /verify & claim/i }).click();
}
