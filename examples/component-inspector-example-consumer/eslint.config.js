import js from '@eslint/js';
import stylisticTs from '@stylistic/eslint-plugin-ts';
import eslintConfigPrettier from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage'],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      unicorn: unicorn,
      '@stylistic/ts': stylisticTs,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@stylistic/ts/padding-line-between-statements': [
        'warn',
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: 'function',
        },
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: 'block-like',
        },
      ],
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      'unicorn/filename-case': [
        'error',
        {
          case: 'camelCase',
          multipleFileExtensions: true,
        },
      ],
    },
  },
);
