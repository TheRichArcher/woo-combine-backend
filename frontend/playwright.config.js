import { defineConfig } from '@playwright/test';

/**
 * Browser E2E (opt-in): start Vite (`npm run dev`) and set PLAYWRIGHT_E2E=1.
 * Optional: PLAYWRIGHT_BASE_URL overrides default http://127.0.0.1:5173
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
});
