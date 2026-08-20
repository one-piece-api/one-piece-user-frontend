import { test, expect } from '@playwright/test';

test('shows the Phase 0 placeholder page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('One Piece API');
});
