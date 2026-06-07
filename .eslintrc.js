// Root ESLint config (flat-config compatible projects may use their own).
// Shared base for both backend (Node/CommonJS) and mobile (TS/React Native).
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['backend/**/*.js'],
      env: { node: true },
      parserOptions: { sourceType: 'script' },
    },
    {
      files: ['mobile/**/*.{ts,tsx}'],
      env: { browser: true, node: true },
      parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '.expo/'],
};
