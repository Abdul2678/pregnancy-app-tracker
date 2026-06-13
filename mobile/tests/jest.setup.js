// tests/jest.setup.js — global mocks for native modules and IO.

// Vector icons (avoids expo-font native font loading in tests)
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props) => React.createElement(Text, props, props.name || 'icon');
  return { Ionicons: Icon, MaterialIcons: Icon, FontAwesome: Icon };
});

// expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(), replace: jest.fn(), back: jest.fn(),
  }),
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

// Secure storage
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationChannelAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3 },
}));

// Localization
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', regionCode: 'GB' }],
  Locale: {},
}));

// Missing-from-package native modules referenced by some screens
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('1'),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}), { virtual: true });

// API client — every test controls responses through this mock
jest.mock('../lib/api', () => {
  const api = {
    get: jest.fn().mockResolvedValue({ data: { data: {} } }),
    post: jest.fn().mockResolvedValue({ data: { data: {} } }),
    put: jest.fn().mockResolvedValue({ data: { data: {} } }),
    delete: jest.fn().mockResolvedValue({ data: { data: {} } }),
  };
  return {
    __esModule: true,
    default: api,
    api,
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
    ACCESS_TOKEN_KEY: 'a', REFRESH_TOKEN_KEY: 'r',
  };
});

// Quieter animation warnings
jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
