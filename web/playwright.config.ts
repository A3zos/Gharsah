import { defineConfig, devices } from '@playwright/test';

// e2e runs against the production build (`vite preview`). Full flows that need
// Firebase run on the emulators (Phase 5: `npm run e2e` inside tool/emu_test.sh).
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // Emulator flows run with `npm run e2e:emu` (playwright.emu.config.ts).
  testIgnore: ['parent.spec.ts', 'child.spec.ts', 'lesson.spec.ts'],
  fullyParallel: true,
  // More parallel browsers time out on a 16 GB dev machine (see the review-notes report).
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ar',
    trace: 'retain-on-failure',
  },
  // The three layouts: phone frames (390), tablet (768), desktop web frames (1280).
  projects: [
    {
      name: 'mobile-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    // Built with the placeholder .env.e2e (stubbed network), then served like Pages will.
    command: `npm run build:e2e && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    // Always rebuild with .env.e2e: a reused server could be serving a build without it.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
