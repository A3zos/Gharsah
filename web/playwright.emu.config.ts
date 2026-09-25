import { defineConfig, devices } from '@playwright/test';

// Full flows against the LOCAL Firebase emulators (never production):
//   1. from app/: firebase emulators:start --only auth,firestore,functions,storage
//   2. from web/: npm run e2e:emu
// The dev server is started with VITE_USE_EMULATORS=1.
const PORT = 5175;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['parent.spec.ts', 'child.spec.ts', 'lesson.spec.ts'],
  fullyParallel: false,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ar',
    trace: 'retain-on-failure',
    permissions: ['microphone'],
    launchOptions: {
      // A fake microphone + no autoplay gesture needed, for the live lesson.
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
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
    command: `npx cross-env VITE_USE_EMULATORS=1 react-router dev --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
