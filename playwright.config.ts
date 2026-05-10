import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: 'http://127.0.0.1:8787',
  use: { headless: true },
  timeout: 30000,
  retries: 0,
});