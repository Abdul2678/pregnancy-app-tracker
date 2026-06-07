// app/_layout.tsx
// Root layout: Redux Provider + auth guard + navigation.

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { store, useAppDispatch, useAppSelector } from '../store';
import { bootstrapAuth } from '../store/authSlice';
import '../lib/i18n';

function AuthGate() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const segments = useSegments();
  const { status, bootstrapped } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!bootstrapped) return;
    const inAuthGroup = segments[0] === '(auth)';
    const isAuthed = status === 'authenticated';

    if (!isAuthed && !inAuthGroup) {
      router.replace('/(auth)');
    } else if (isAuthed && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, bootstrapped, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="features/birth-plan" options={{ headerShown: true, title: 'Birth Plan' }} />
      <Stack.Screen name="features/hospital-bag" options={{ headerShown: true, title: 'Hospital Bag' }} />
      <Stack.Screen
        name="features/contraction-timer"
        options={{ headerShown: true, title: 'Contraction Timer' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <StatusBar style="dark" />
        <AuthGate />
      </Provider>
    </GestureHandlerRootView>
  );
}
