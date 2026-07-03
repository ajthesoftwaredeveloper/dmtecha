module.exports = {
  root: true,
  extends: ['@dmtecha/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
