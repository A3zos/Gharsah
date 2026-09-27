import { defineConfig, devices } from '@playwright/test';

// Full flows against a real Supabase project (see e2e/stack.ts for the env):
//   local:  npx supabase start && npx supabase functions serve, then npm run e2e:stack
//   remote: E2E_ALLOW_REMOTE=1 SUPABASE_E2E_URL=https://<ref>.supabase.co … npm run e2e:stack
// The dev server gets the URL + anon key; the service key is only used by e2e/stack.ts to seed.
// Afterwards: npm run e2e:cleanup (deletes every …@test.local user and their data).
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
    command: `react-router dev --port ${PORT} --strictPort`,
    env: {
      VITE_SUPABASE_URL: process.env.SUPABASE_E2E_URL ?? 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_E2E_ANON_KEY ?? '',
      VITE_TRIAL_SUBSCRIBE: '1',
    },
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
