import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'out/**', 'coverage/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly'
      }
    },
    "env": {
      "node": true,
      "es2021": true
    }
  },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
