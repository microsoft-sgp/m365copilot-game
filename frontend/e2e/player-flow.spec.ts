import { expect, test } from '@playwright/test';
import {
  launchAssignedBoard,
  mockApi,
  onboardPlayer,
  proofForBrainstormList,
  proofForStudyPlan,
  proofForWorkshopAgenda,
  verifyTileByTitle,
} from './fixtures';

test('player can onboard, start an assigned pack, clear a line, and see activity', async ({
  page,
}) => {
  const api = await mockApi(page);

  await onboardPlayer(page, { name: 'Ada', email: 'ada@nus.edu.sg' });
  await launchAssignedBoard(page);
  await expect(page.getByText('Pack #001')).toBeVisible();
  await expect(page.getByText('Brainstorm List')).toBeVisible();

  await verifyTileByTitle(page, 'Brainstorm List', proofForBrainstormList());
  await verifyTileByTitle(page, 'Workshop Agenda', proofForWorkshopAgenda());
  await verifyTileByTitle(page, 'Study Plan Generator', proofForStudyPlan());

  await expect(page.getByText(/BINGO! Row 1/)).toBeVisible();
  await expect(page.getByText(/CO-APR26-001-R1-/).first()).toBeVisible();
  await page.getByRole('button', { name: /keep playing/i }).click();

  await expect(page.locator('.tile.cleared')).toHaveCount(3);
  await expect(api.events.some((event) => event?.eventType === 'line_won')).toBeTruthy();
  expect(api.sessionUpdates.some((update) => update?.boardState)).toBeTruthy();

  // After /api/sessions issues the playerToken, every subsequent game-API
  // call MUST carry it in the X-Player-Token header (cookie-fallback path).
  const subsequentEventCalls = api.playerTokenHeaders.filter(
    (call) => call.path === '/api/events' && call.method === 'POST',
  );
  expect(subsequentEventCalls.length).toBeGreaterThan(0);
  for (const call of subsequentEventCalls) {
    expect(call.token).toBe('e2e-fixture-player-token');
  }

  await page.reload();
  await expect(page.getByText('Pack #001')).toBeVisible();
  await expect(page.getByText(/Player: Ada/)).toBeVisible();
  await expect(page.locator('.tile.cleared')).toHaveCount(3);

  await page.getByRole('button', { name: /activity/i }).click();
  await expect(page.getByText('Organization Leaderboard')).toBeVisible();
  await expect(page.getByText('NUS')).toBeVisible();
  await expect(page.locator('.font-mono', { hasText: /CO-APR26-001-R1-/ }).last()).toBeVisible();
});
