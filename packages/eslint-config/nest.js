/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./base.js'],
  env: {
    node: true,
    jest: true,
  },
  rules: {
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
  },
};
