// app/_layout.tsx
// Root layout: Redux Provider + auth + onboarding guard + navigation.

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { store, useAppDispatch, useAppSelector } from '../store';
import { bootstrapAuth } from '../store/authSlice';
import '../lib/i18n';

function AuthGate() {
  const dispatch  = useAppDispatch();
  const router    = useRouter();
  const segments  = useSegments();
  const { status, bootstrapped } = useAppSelector((s) => s.auth);
  const { onboardingCompleted }  = useAppSelector((s) => s.profile);

  useEffect(() => {
    dispatch(bootstrapAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!bootstrapped) return;

    const inAuthGroup       = segments[0] === '(auth)';
    const onOnboarding      = segments[1] === 'onboarding';
    const isAuthed          = status === 'authenticated';
    const needsOnboarding   = isAuthed && !onboardingCompleted;

    if (!isAuthed && !inAuthGroup) {
      // Not logged in → sign-in screen
      router.replace('/(auth)');
    } else if (isAuthed && needsOnboarding && !onOnboarding) {
      // Logged in but onboarding not done → onboarding
      router.replace('/(auth)/onboarding');
    } else if (isAuthed && onboardingCompleted && inAuthGroup) {
      // Fully onboarded → main app
      router.replace('/(tabs)');
    }
  }, [status, bootstrapped, onboardingCompleted, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
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
      <Stack.Screen
        name="features/mental-health"
        options={{ headerShown: false }}
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
