const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettierConfig = require('eslint-config-prettier');
const importPlugin = require('eslint-plugin-import');
const jestPlugin = require('eslint-plugin-jest');
const globals = require('globals');

const TS_FILES = ['**/*.ts', '**/*.tsx'];

// A flat config without `files` applies to every file. The shared configs below
// are unscoped, so pin each one to TypeScript sources to keep the behaviour of
// the `--ext .ts,.tsx` flag that flat config dropped.
const scoped = (config) =>
  [config].flat().map((entry) => ({ ...entry, files: TS_FILES }));

module.exports = [
  { ignores: ['build/**', 'coverage/**', 'dist/**'] },
  ...scoped(js.configs.recommended),
  ...scoped(tsPlugin.configs['flat/eslint-recommended']),
  ...scoped(tsPlugin.configs['flat/recommended']),
  ...scoped(jestPlugin.configs['flat/recommended']),
  ...scoped(prettierConfig),
  {
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: globals.node,
    },
    plugins: { import: importPlugin },
    rules: {
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
      'import/order': [
        'error',
        { alphabetize: { order: 'asc' }, 'newlines-between': 'never' },
      ],
      'no-return-await': 'error',
      'no-console': 'error',
      'import/no-default-export': 'error',
      'import/no-extraneous-dependencies': 'error',
      'import/no-unassigned-import': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
      '@typescript-eslint/no-unused-expressions': 'error',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
