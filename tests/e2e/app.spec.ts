import { expect, test } from '@playwright/test';

test('shows first-run workflow guide', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Scholia Studio').first()).toBeVisible();
  await expect(page.getByText('本地优先的科研写作工作台')).toBeVisible();
  await expect(page.getByRole('button', { name: /写论文/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /做研究记录/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /审阅 PDF/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /写周报/ })).toBeVisible();
});

test('can create a guided research scratch note without a workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /做研究记录/ }).click();
  await expect(page.getByText('研究记录起步')).toBeVisible();
  await expect(page.getByText('可能进入论文的结论')).toBeVisible();
});
