// lib/notifications.ts
// Push notification registration + deep-link routing.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Router } from 'expo-router';

import api from './api';

// Show notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Ask permission, get the Expo push token, register it with the backend. */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bloom',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#CC6E9A',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await api.put('/notifications/push-token', {
      pushToken: token,
      pushPlatform: Platform.OS === 'ios' ? 'ios' : 'android',
    });

    return token;
  } catch {
    return null;
  }
}

// ── Deep linking ──────────────────────────────────────────────────────────────
// Each notification carries data: { screen, ...params }. Map screen → route.

const SCREEN_ROUTES: Record<string, string> = {
  home:                 '/(tabs)',
  learn:                '/(tabs)/learn',
  track:                '/(tabs)/track',
  plan:                 '/(tabs)/plan',
  chat:                 '/(tabs)/chat',
  'kick-counter':       '/features/kick-counter',
  'contraction-timer':  '/features/contraction-timer',
  'newborn-tracker':    '/features/newborn-tracker',
  'mom-recovery':       '/features/mom-recovery',
  'mental-health':      '/features/mental-health',
};

export function routeForNotification(data: Record<string, any> | undefined): { pathname: string; params?: Record<string, any> } | null {
  if (!data?.screen) return null;
  const pathname = SCREEN_ROUTES[data.screen];
  if (!pathname) return null;
  const { screen, notificationId, type, ...params } = data;
  return { pathname, params: Object.keys(params).length ? params : undefined };
}

/**
 * Attach the tap handler: navigates to the deep-linked screen and
 * marks the notification as opened on the server.
 */
export function attachNotificationListeners(router: Router): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, any>;

    if (data?.notificationId) {
      api.put(`/notifications/${data.notificationId}/read`).catch(() => {});
    }

    const route = routeForNotification(data);
    if (route) {
      // Slight delay so navigation is ready on cold start
      setTimeout(() => {
        router.push(route as any);
      }, 350);
    }
  });

  // Handle notification that launched the app from a killed state
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const data = response.notification.request.content.data as Record<string, any>;
    const route = routeForNotification(data);
    if (route) setTimeout(() => router.push(route as any), 700);
  });

  return () => sub.remove();
}
