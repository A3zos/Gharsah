import { defineConfig, devices } from '@playwright/test';

// e2e runs against the production build (`vite preview`). Full flows that need
// Firebase run on the emulators (Phase 5: `npm run e2e` inside tool/emu_test.sh).
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // Emulator flows run with `npm run e2e:emu` (playwright.emu.config.ts).
  // i18n.spec.ts: the language matrix (playwright.i18n.config.ts).
  testIgnore: ['parent.spec.ts', 'child.spec.ts', 'lesson.spec.ts', 'i18n.spec.ts'],
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
    // Built with placeholder Supabase values (stubbed network — see build:e2e), then served like Pages will.
    command: `npm run build:e2e && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    // Always rebuild for e2e: a reused server could be serving a build without the placeholders.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
