import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.SPECLENS_E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${process.env.SPECLENS_E2E_PORT ?? '3000'}`,
    url: process.env.SPECLENS_E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    // The OLLAMA E2E runner always chooses an exclusive port and must never
    // attach to a developer's already-running SpecLens or Ollama service.
    reuseExistingServer: process.env.SPECLENS_E2E_ALLOW_REUSE === '1',
    env: {
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
      OLLAMA_ALLOWED_BASE_URLS: process.env.OLLAMA_ALLOWED_BASE_URLS ?? 'http://127.0.0.1:11434,http://localhost:11434',
      OLLAMA_MODEL_ID: process.env.OLLAMA_MODEL_ID ?? 'llama3.2:3b',
      SPECLENS_DB_PATH: process.env.SPECLENS_DB_PATH ?? '',
    },
  },
});
