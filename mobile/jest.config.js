// jest.config.js — React Native tests via jest-expo
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx,js,jsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-redux|@reduxjs/toolkit|immer|redux|redux-thunk|reselect|i18n-js))',
  ],
};
