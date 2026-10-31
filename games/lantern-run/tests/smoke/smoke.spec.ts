import { test, expect } from '@playwright/test';

test('Lantern Run starts and advances', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('Lantern Run · LIVE');
  const initial = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  await page.waitForTimeout(800);
  const later = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(later.run.distance).toBeGreaterThan(initial.run.distance);
});
