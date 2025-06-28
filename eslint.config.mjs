import boundaries from 'eslint-plugin-boundaries';

/**
 * ESLint – Monorepo root configuration
 * -------------------------------
 * – Uses eslint-plugin-boundaries to keep layer boundaries honest.
 * – Starts in "warn" mode during migration; flip to "error" once complete.
 */
export default [
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    ignores: ['node_modules/**', 'dist/**', '.next/**'],
    plugins: {
      boundaries,
    },
    settings: {
      // Tell boundaries what the layers look like
      'boundaries/elements': [
        { type: 'core', pattern: 'src/{core,utils}/*' },
        { type: 'shared', pattern: 'src/shared/*' },
        { type: 'modules', pattern: 'src/modules/*' },
        { type: 'app', pattern: 'src/app/*' },
      ],
    },
    rules: {
      // Disallow weird cross-layer imports
      'boundaries/element-types': [
        'warn', // <-- migrate: switch to "error" later
        {
          default: 'disallow',
          rules: [
            { from: 'core', allow: [] },
            { from: 'shared', allow: ['core', 'shared'] },
            { from: 'modules', allow: ['core', 'shared', 'modules'] },
            { from: 'app', allow: ['core', 'shared', 'modules', 'app'] },
          ],
        },
      ],
    },
  },
];
