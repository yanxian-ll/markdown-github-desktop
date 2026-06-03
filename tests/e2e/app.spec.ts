import { expect, test } from '@playwright/test';

test('opens editor and preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Markdown GitHub Desktop').first()).toBeVisible();
  await expect(page.getByText('GitHub').first()).toBeVisible();
});
