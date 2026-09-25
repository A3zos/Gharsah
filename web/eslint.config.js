import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'build',
      '.react-router',
      'playwright-report',
      'test-results',
      'src/styles/tokens.generated.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Route modules export loaders/meta next to the component (React Router convention).
      'react-refresh/only-export-components': [
        'warn',
        {
          allowExportNames: [
            'meta',
            'links',
            'clientLoader',
            'clientAction',
            'loader',
            'action',
            'HydrateFallback',
            'ErrorBoundary',
            'Layout',
            'handle',
          ],
        },
      ],
    },
  },
  {
    // The lesson agent is framework-free: no React, no DOM, no Firebase.
    files: ['src/lesson/**/*.ts'],
    ignores: ['src/lesson/browser/**', 'src/lesson/web/**', 'src/lesson/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'firebase', 'firebase/*', '../browser/*', '*/browser/*'] },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'Audio',
        'AudioContext',
      ],
    },
  },
);
