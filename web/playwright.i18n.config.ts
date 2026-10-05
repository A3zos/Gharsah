import { defineConfig, devices } from '@playwright/test';

// The language matrix (e2e/i18n.spec.ts): every reachable route in ar / en / id at 375 and 1280.
// Public pages run on the production build (`vite preview`), or on a deployed site with
// BASE_URL=https://gharsah.pages.dev. The child pages need the dev-only sample child
// (`?preview=1`, dropped from production builds), so a dev server runs beside the preview.
const PREVIEW_PORT = 4173;
export const DEV_PORT = 5181;
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['i18n.spec.ts'],
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: remote ?? `http://localhost:${PREVIEW_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-375', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: remote
    ? undefined
    : [
        {
          command: `npm run build:e2e && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
          port: PREVIEW_PORT,
          reuseExistingServer: false,
          timeout: 240_000,
        },
        {
          // the AI flag off: the child pages only render (nothing is called)
          command: `npx cross-env VITE_SUPABASE_URL=https://e2e-placeholder.supabase.co VITE_SUPABASE_ANON_KEY=e2e-placeholder-anon-key VITE_AI_AGENT=0 react-router dev --port ${DEV_PORT} --strictPort`,
          port: DEV_PORT,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
});
