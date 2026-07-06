import { defineConfig } from '@playwright/test';

const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5433/invoices_e2e';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60000,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm --filter @invoices/api start',
      cwd: '../..',
      url: 'http://localhost:3333/trpc/health.ping',
      env: { DATABASE_URL: E2E_DB, API_PORT: '3333', WEB_ORIGIN: 'http://localhost:3000' },
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @invoices/web dev',
      cwd: '../..',
      url: 'http://localhost:3000/login',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
