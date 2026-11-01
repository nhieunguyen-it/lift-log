import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'dev-dist', 'data/raw', 'playwright-report', 'test-results', 'node_modules'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: [
      'src/analysis/**/*.ts',
      'src/program/**/*.ts',
      'src/data/**/*.ts',
      'src/config/training.ts',
      'src/lib/units.ts',
      'src/lib/weight.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/db', '@/db/*', '@/components/*', '@/pages/*'],
              message: 'Portable analysis core must not depend on persistence or UI.',
            },
            {
              group: ['react', 'react-dom', 'react/*', 'dexie', 'dexie-react-hooks'],
              message: 'Portable analysis core must stay framework-free.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
