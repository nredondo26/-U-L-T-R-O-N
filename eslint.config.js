export default [
  {
    ignores: ['dist/', '*.test.ts'],
  },
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
];
