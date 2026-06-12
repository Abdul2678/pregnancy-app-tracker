// app/_layout.tsx
// Root layout: Redux Provider + auth + onboarding guard + navigation.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { store, useAppDispatch, useAppSelector } from '../store';
import { bootstrapAuth } from '../store/authSlice';
import { loadSettings } from '../store/settingsSlice';
import { loadSubscription } from '../store/subscriptionSlice';
import { registerForPushNotifications, attachNotificationListeners } from '../lib/notifications';
import { isBiometricLockEnabled, authenticate } from '../lib/biometrics';
import '../lib/i18n';

// ── Biometric lock gate ───────────────────────────────────────────────────────
// Locks on cold start and whenever the app returns from background.

function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null); // null = checking
  const appStateRef = useRef(AppState.currentState);

  const tryUnlock = async () => {
    const success = await authenticate();
    if (success) setLocked(false);
  };

  useEffect(() => {
    (async () => {
      const enabled = await isBiometricLockEnabled();
      if (!enabled) { setLocked(false); return; }
      setLocked(true);
      tryUnlock();
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/background/) && next === 'active') {
        const enabled = await isBiometricLockEnabled();
        if (enabled) { setLocked(true); tryUnlock(); }
      }
    });
    return () => sub.remove();
  }, []);

  if (locked === false) return <>{children}</>;

  return (
    <View style={lockStyles.screen}>
      <Text style={lockStyles.emoji}>🔐</Text>
      <Text style={lockStyles.title}>Bloom is locked</Text>
      <Text style={lockStyles.sub}>Your health data is protected.</Text>
      <TouchableOpacity style={lockStyles.btn} onPress={tryUnlock} activeOpacity={0.85}>
        <Text style={lockStyles.btnText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDF0F8', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji:  { fontSize: 48, marginBottom: 16 },
  title:  { fontSize: 22, fontWeight: '900', color: '#3D1440', marginBottom: 6 },
  sub:    { fontSize: 14, color: '#8A7359', marginBottom: 28 },
  btn:    { backgroundColor: '#CC6E9A', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});

function AuthGate() {
  const dispatch  = useAppDispatch();
  const router    = useRouter();
  const segments  = useSegments();
  const { status, bootstrapped, user } = useAppSelector((s) => s.auth);
  const { onboardingCompleted }        = useAppSelector((s) => s.profile);

  useEffect(() => {
    dispatch(loadSettings());
    dispatch(bootstrapAuth());
    dispatch(loadSubscription());
  }, [dispatch]);

  // Push notifications: register token once authenticated, attach tap handler
  useEffect(() => {
    if (status !== 'authenticated') return;
    registerForPushNotifications();
    const detach = attachNotificationListeners(router);
    return detach;
  }, [status, router]);

  useEffect(() => {
    if (!bootstrapped) return;

    const inAuthGroup    = segments[0] === '(auth)';
    const inPartnerGroup = segments[0] === '(partner)';
    const isAuthed       = status === 'authenticated';
    const isPartner      = user?.accountType === 'partner';

    if (!isAuthed && !inAuthGroup) {
      router.replace('/(auth)');
      return;
    }

    if (isAuthed && isPartner && !inPartnerGroup) {
      router.replace('/(partner)');
      return;
    }

    if (isAuthed && !isPartner) {
      const onOnboarding = segments[1] === 'onboarding';
      if (!onboardingCompleted && !onOnboarding && !inAuthGroup) {
        router.replace('/(auth)/onboarding');
      } else if (onboardingCompleted && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [status, bootstrapped, user, onboardingCompleted, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(partner)" />
      <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="notification-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="privacy" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen
        name="features/birth-plan"
        options={{ headerShown: true, title: 'Birth Plan', headerTintColor: '#CC6E9A' }}
      />
      <Stack.Screen
        name="features/hospital-bag"
        options={{ headerShown: true, title: 'Hospital Bag', headerTintColor: '#CC6E9A' }}
      />
      <Stack.Screen
        name="features/contraction-timer"
        options={{ headerShown: true, title: 'Contraction Timer', headerTintColor: '#CC6E9A' }}
      />
      <Stack.Screen
        name="features/kick-counter"
        options={{ headerShown: true, title: 'Kick Counter', headerTintColor: '#CC6E9A' }}
      />
      <Stack.Screen name="features/mental-health" options={{ headerShown: false }} />
      <Stack.Screen name="features/paywall" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <StatusBar style="dark" />
        <BiometricGate>
          <AuthGate />
        </BiometricGate>
      </Provider>
    </GestureHandlerRootView>
  );
}
