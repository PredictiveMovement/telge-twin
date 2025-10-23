import globals from 'globals'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '__tests__', '.cache'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off',

      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',

      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/ban-ts-comment': 'warn',

      'no-undef': 'off',
      'sort-imports': 'warn',
    },
  }
)
