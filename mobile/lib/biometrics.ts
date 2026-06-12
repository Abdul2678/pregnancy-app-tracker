// lib/biometrics.ts
// Optional Face ID / fingerprint app lock. Requires expo-local-authentication
// (added to package.json — run `npx expo install expo-local-authentication`).
// Gracefully degrades if the native module is unavailable.

import * as SecureStore from 'expo-secure-store';

const LOCK_KEY = 'bloom_biometric_lock';

let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LocalAuthentication = require('expo-local-authentication');
} catch {
  LocalAuthentication = null;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(LOCK_KEY)) === '1';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(LOCK_KEY, enabled ? '1' : '0');
}

/** Prompt for Face ID / fingerprint. Returns true on success. */
export async function authenticate(): Promise<boolean> {
  if (!LocalAuthentication) return true; // module missing — don't lock users out
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Bloom',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
