import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierRecommended,
  {
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'prettier/prettier': 'error',

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Layered-architecture boundaries (core / shared / modules / app).
  // Severity is 'warn' (not 'error') so `yarn lint` stays at 0 errors while
  // still surfacing the pre-existing cross-layer couplings that the current
  // file placement reveals (core/http -> shared & modules types, shared
  // Header -> blog module). Those are real coupling debts to resolve later,
  // not config noise — promote to 'error' once they are removed.
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/ignore': [
        'src/messages/**/*',
        'src/proxy.ts',
        '**/global.d.ts',
        'scripts/**/*',
      ],
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**/*', mode: 'full' },
        { type: 'shared', pattern: 'src/shared/**/*', mode: 'full' },
        {
          type: 'module',
          pattern: 'src/modules/*/**/*',
          mode: 'full',
          capture: ['moduleName'],
        },
        { type: 'app', pattern: 'src/app/**/*', mode: 'full' },
      ],
    },
    rules: {
      // Only the layering rule is enabled; the other boundaries rules
      // (entry-point/external/no-private/...) are intentionally left off.
      'boundaries/element-types': [
        'warn',
        {
          default: 'disallow',
          rules: [
            { from: ['core'], allow: ['core'] },
            { from: ['shared'], allow: ['core', 'shared'] },
            {
              from: ['module'],
              allow: [
                'core',
                'shared',
                ['module', { moduleName: '${from.moduleName}' }],
              ],
            },
            { from: ['app'], allow: ['core', 'shared', 'module', 'app'] },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'build/',
      'dist/',
      '.vercel/',
      'coverage/',
    ],
  },
];

export default eslintConfig;
