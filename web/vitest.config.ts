import { defineConfig } from 'vitest/config';

import { contentAlias } from './plugins/content.ts';

// Kept separate from vite.config.ts: the React Router plugin isn't used in tests.
export default defineConfig({
  resolve: { alias: contentAlias },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    restoreMocks: true,
  },
});
