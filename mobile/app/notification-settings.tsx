// app/notification-settings.tsx
// Per-type notification toggles, quiet hours, frequency preference, test button.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';

type Settings = {
  dailyTip: boolean;
  weeklyUpdate: boolean;
  appointmentReminder: boolean;
  moodCheckin: boolean;
  kickCelebration: boolean;
  contractionAlert: boolean;
  weekRollover: boolean;
  symptomFollowup: boolean;
  feedingReminder: boolean;
  postpartumCheckin: boolean;
  frequency: 'all' | 'important' | 'minimal';
};

const TOGGLES: { key: keyof Settings; emoji: string; label: string; sub: string }[] = [
  { key: 'dailyTip',            emoji: '🌱', label: 'Daily tip',              sub: 'One helpful tip each morning at 8am' },
  { key: 'weeklyUpdate',        emoji: '👶', label: 'Weekly baby update',     sub: 'Milestones and development, Mondays at 9am' },
  { key: 'weekRollover',        emoji: '🎀', label: 'New week celebration',   sub: 'The day you enter a new pregnancy week' },
  { key: 'appointmentReminder', emoji: '🗓️', label: 'Appointment reminders',  sub: '1 day and 1 hour before each appointment' },
  { key: 'moodCheckin',         emoji: '💜', label: 'Mood check-in nudge',    sub: 'A gentle nudge if you haven\'t checked in for 2 days' },
  { key: 'kickCelebration',     emoji: '🎉', label: 'Kick count celebration', sub: 'When you reach your kick goal' },
  { key: 'contractionAlert',    emoji: '⏱️', label: 'Contraction patterns',   sub: 'When your contractions become regular' },
  { key: 'symptomFollowup',     emoji: '💗', label: 'Symptom follow-ups',     sub: 'A tip after you log a symptom' },
  { key: 'postpartumCheckin',   emoji: '🌸', label: 'Recovery check-in',      sub: 'Daily wellbeing check while in postpartum mode' },
  { key: 'feedingReminder',     emoji: '🍼', label: 'Feeding reminders',      sub: 'Every ~3 hours during the day (postpartum, opt-in)' },
];

const FREQUENCIES: { value: Settings['frequency']; label: string; sub: string }[] = [
  { value: 'all',       label: 'All',            sub: 'Tips, milestones, reminders — the full experience' },
  { value: 'important', label: 'Important only', sub: 'Reminders, check-ins and milestones — no daily tips' },
  { value: 'minimal',   label: 'Minimal',        sub: 'Only appointments and safety alerts' },
];

const QUIET_PRESETS = [
  { label: 'Off',          start: null,    end: null },
  { label: '10pm – 7am',   start: '22:00', end: '07:00' },
  { label: '9pm – 8am',    start: '21:00', end: '08:00' },
  { label: '11pm – 6am',   start: '23:00', end: '06:00' },
];

export default function NotificationSettings() {
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [quietStart, setQuietStart] = useState<string | null>(null);
  const [quietEnd, setQuietEnd]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/notifications/settings');
        const d = data?.data ?? data;
        setSettings(d.settings);
        setQuietStart(d.quietHoursStart);
        setQuietEnd(d.quietHoursEnd);
      } catch {
        Alert.alert('Could not load settings', 'Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async (patch: Record<string, any>) => {
    try {
      const { data } = await api.put('/notifications/settings', patch);
      const d = data?.data ?? data;
      if (d.settings) setSettings(d.settings);
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
    }
  }, []);

  const onToggle = (key: keyof Settings, value: boolean) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    save({ [key]: value });
  };

  const onFrequency = (value: Settings['frequency']) => {
    setSettings((s) => (s ? { ...s, frequency: value } : s));
    save({ frequency: value });
  };

  const onQuietPreset = (start: string | null, end: string | null) => {
    setQuietStart(start);
    setQuietEnd(end);
    save({ quietHoursStart: start, quietHoursEnd: end });
  };

  const onTest = async () => {
    setTesting(true);
    try {
      // Make sure the token is registered first
      const token = await registerForPushNotifications();
      if (!token) {
        Alert.alert('Permission needed', 'Please allow notifications in your device settings first.');
        return;
      }
      const { data } = await api.post('/notifications/test');
      const d = data?.data ?? data;
      Alert.alert(
        d.sent ? 'Test sent! 🌸' : 'Not sent',
        d.sent
          ? 'You should receive it within a few seconds.'
          : 'The test could not be queued — check that notifications are enabled.'
      );
    } catch {
      Alert.alert('Test failed', 'Please try again.');
    } finally {
      setTesting(false);
    }
  };

  if (loading || !settings) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color="#CC6E9A" size="large" />
      </View>
    );
  }

  const quietActive = (p: typeof QUIET_PRESETS[number]) =>
    p.start === quietStart && p.end === quietEnd;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          We only send what helps — like a caring friend, never spam. Turn anything off, any time.
        </Text>

        {/* Frequency */}
        <Text style={s.sectionTitle}>How much do you want to hear from us?</Text>
        <View style={s.card}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity key={f.value} style={s.freqRow} onPress={() => onFrequency(f.value)}>
              <View style={[s.radio, settings.frequency === f.value && s.radioActive]} />
              <View style={{ flex: 1 }}>
                <Text style={s.freqLabel}>{f.label}</Text>
                <Text style={s.freqSub}>{f.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quiet hours */}
        <Text style={s.sectionTitle}>Quiet hours 🌙</Text>
        <View style={s.card}>
          <Text style={s.quietHint}>No notifications during these hours (urgent safety alerts excepted).</Text>
          <View style={s.quietRow}>
            {QUIET_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={[s.quietChip, quietActive(p) && s.quietChipActive]}
                onPress={() => onQuietPreset(p.start, p.end)}
              >
                <Text style={[s.quietChipText, quietActive(p) && s.quietChipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Per-type toggles */}
        <Text style={s.sectionTitle}>Notification types</Text>
        <View style={s.card}>
          {TOGGLES.map((t, i) => (
            <View key={t.key} style={[s.toggleRow, i > 0 && s.toggleRowBorder]}>
              <Text style={s.toggleEmoji}>{t.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>{t.label}</Text>
                <Text style={s.toggleSub}>{t.sub}</Text>
              </View>
              <Switch
                value={Boolean(settings[t.key])}
                onValueChange={(v) => onToggle(t.key, v)}
                trackColor={{ false: '#E8DFD0', true: '#E5A8C6' }}
                thumbColor={settings[t.key] ? '#CC6E9A' : '#FFFFFF'}
              />
            </View>
          ))}
        </View>

        {/* Test */}
        <TouchableOpacity style={s.testBtn} onPress={onTest} disabled={testing} activeOpacity={0.85}>
          {testing
            ? <ActivityIndicator color="#FFFFFF" />
            : (
              <>
                <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                <Text style={s.testText}>Send a test notification</Text>
              </>
            )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#FDF0F8' },
  center:  { alignItems: 'center', justifyContent: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#3D1440' },
  content: { padding: 20, paddingTop: 4 },

  intro:   { fontSize: 13, color: '#5A4636', lineHeight: 19, marginBottom: 20 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#3D1440', marginBottom: 10 },
  card:    { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 6, marginBottom: 24 },

  freqRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  radio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#DDD5C4' },
  radioActive: { borderColor: '#CC6E9A', backgroundColor: '#CC6E9A' },
  freqLabel: { fontSize: 14, fontWeight: '700', color: '#3D1440' },
  freqSub:   { fontSize: 12, color: '#8A7359', marginTop: 1 },

  quietHint: { fontSize: 12, color: '#8A7359', padding: 12, paddingBottom: 6 },
  quietRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, paddingTop: 4 },
  quietChip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FDF0F8' },
  quietChipActive: { backgroundColor: '#CC6E9A' },
  quietChipText: { fontSize: 12, fontWeight: '700', color: '#5A4636' },
  quietChipTextActive: { color: '#FFFFFF' },

  toggleRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: '#F5EAE0' },
  toggleEmoji:     { fontSize: 20 },
  toggleLabel:     { fontSize: 14, fontWeight: '700', color: '#3D1440' },
  toggleSub:       { fontSize: 11, color: '#8A7359', marginTop: 1 },

  testBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8E72B8', borderRadius: 16, paddingVertical: 15 },
  testText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
