/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    './base.js',
    'next/core-web-vitals',
  ],
  env: {
    browser: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
  },
};
