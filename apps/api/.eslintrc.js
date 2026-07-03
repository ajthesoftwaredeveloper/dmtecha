module.exports = {
  root: true,
  extends: ['@dmtecha/eslint-config/nest'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
