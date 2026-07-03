module.exports = {
  root: true,
  extends: ['@dmtecha/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
