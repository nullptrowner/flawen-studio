import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    headless: true,
    viewport: { width: 1500, height: 1000 },
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: !process.env.CI,
  },
});
