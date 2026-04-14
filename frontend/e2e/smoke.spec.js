import { test, expect } from '@playwright/test';

const e2eEnabled = process.env.PLAYWRIGHT_E2E === '1';

/**
 * Planned coverage (expand here):
 * - Sign-in / role selection → coach dashboard
 * - Create league + event → player CSV import
 * - Live drill entry → rankings update
 * - Check-in / scanner happy paths
 */
const describeSmoke = e2eEnabled ? test.describe : test.describe.skip;

describeSmoke('smoke', () => {
  test('app shell loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
