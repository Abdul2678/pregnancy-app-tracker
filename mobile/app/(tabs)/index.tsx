// app/(tabs)/index.tsx
// Home: week progress, daily tip, quick actions.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { WeekProgress } from '../../components/WeekProgress';
import { DailyTip } from '../../components/DailyTip';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchDailyTip } from '../../store/profileSlice';

const QUICK_ACTIONS = [
  { label: 'Birth Plan', icon: 'document-text', route: '/features/birth-plan' },
  { label: 'Hospital Bag', icon: 'bag-handle', route: '/features/hospital-bag' },
  { label: 'Contractions', icon: 'timer', route: '/features/contraction-timer' },
] as const;

export default function Home() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { profile, dailyTip } = useAppSelector((s) => s.profile);
  const week = profile?.currentWeek ?? 1;

  useEffect(() => {
    dispatch(fetchDailyTip());
  }, [dispatch]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hello 👋</Text>
      {profile?.onboardingMessage ? (
        <Text style={styles.welcome}>{profile.onboardingMessage}</Text>
      ) : null}

      <View style={styles.ring}>
        <WeekProgress week={week} />
      </View>

      <DailyTip tip={dailyTip} />

      <Text style={styles.section}>Quick Actions</Text>
      <View style={styles.actions}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable key={a.label} style={styles.action} onPress={() => router.push(a.route)}>
            <Ionicons name={a.icon} size={26} color="#C97B63" />
            <Text style={styles.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  greeting: { fontSize: 28, fontWeight: '800', color: '#5A4636' },
  welcome: { color: '#8A7359', marginTop: 4, marginBottom: 12, lineHeight: 20 },
  ring: { alignItems: 'center', marginVertical: 16 },
  section: { fontSize: 18, fontWeight: '700', color: '#5A4636', marginTop: 16, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE5D8',
  },
  actionLabel: { marginTop: 8, fontSize: 13, color: '#5A4636', fontWeight: '600', textAlign: 'center' },
});
