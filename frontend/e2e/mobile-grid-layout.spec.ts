import { expect, type Page, test } from '@playwright/test';
import { mockApi, proofForAnyTile, verifyTileByIndex } from './fixtures';

const VIEWPORTS: { width: number; height: number; label: string }[] = [
  { width: 320, height: 568, label: '320px (iPhone SE 1st gen)' },
  { width: 375, height: 667, label: '375px (iPhone SE 2nd gen)' },
  { width: 414, height: 896, label: '414px (iPhone XR)' },
  { width: 640, height: 800, label: '640px (sm: breakpoint)' },
];

async function setupBoard(page: Page) {
  await mockApi(page);
  await page.goto('/');
  await page.getByPlaceholder('e.g. Alex').fill('Ada');
  await page.getByPlaceholder('you@university.edu.sg').fill('ada@nus.edu.sg');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /launch board/i }).click();
  await expect(page.getByText('Pack #001')).toBeVisible();
}

test.describe('mobile bingo grid layout', () => {
  for (const vp of VIEWPORTS) {
    test(`renders 3 columns with no horizontal overflow at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupBoard(page);

      const tiles = page.locator('.tile');
      await expect(tiles).toHaveCount(9);

      // Verify 3 columns by inspecting tile centers (3 distinct x-positions per row).
      const tileBoxes = await tiles.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            right: Math.round(r.right),
          };
        }),
      );
      const distinctX = [...new Set(tileBoxes.map((b) => b.x))].sort((a, b) => a - b);
      expect(distinctX).toHaveLength(3);

      // No tile may extend past the viewport width.
      for (const box of tileBoxes) {
        expect(box.right).toBeLessThanOrEqual(vp.width);
      }

      // No horizontal page overflow.
      const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(docWidth).toBeLessThanOrEqual(vp.width);
    });
  }

  test('opens tile modal and closes win modal without horizontal overflow on a narrow viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await setupBoard(page);

    await page.locator('.tile').first().click();
    await expect(page.locator('textarea')).toBeVisible();
    await expectNoHorizontalOverflow(page, 320);
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.locator('textarea')).toBeHidden();

    await verifyTileByIndex(page, 0, proofForAnyTile(1, 0));
    await verifyTileByIndex(page, 1, proofForAnyTile(1, 1));
    await verifyTileByIndex(page, 2, proofForAnyTile(1, 2));

    await expect(page.getByText(/BINGO! Row 1/)).toBeVisible();
    await expectNoHorizontalOverflow(page, 320);
    await page.getByRole('button', { name: /keep playing/i }).click();
    await expect(page.getByText(/BINGO! Row 1/)).toBeHidden();
    await expectNoHorizontalOverflow(page, 320);
  });
});

async function expectNoHorizontalOverflow(page: Page, viewportWidth: number) {
  const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(docWidth).toBeLessThanOrEqual(viewportWidth);
}
