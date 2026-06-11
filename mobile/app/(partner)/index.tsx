// app/(partner)/index.tsx
// Partner home screen: weekly overview, mood (privacy-gated), upcoming appointments, tips.

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadPartnerView } from '../../store/partnerSlice';
import { logout } from '../../store/authSlice';

const PARTNER_TIPS: Record<number, string[]> = {
  1:  ['Your partner has just found out they\'re pregnant. Let them rest as much as possible.', 'Offer to handle household tasks — fatigue is intense in the first weeks.'],
  2:  ['Morning sickness often peaks now. Keep crackers and water handy.', 'Be patient with mood changes — hormone shifts are very real.'],
  3:  ['The first trimester is almost over! Share the excitement of the 12-week scan.', 'Help research prenatal vitamins and healthy meal ideas.'],
};

function getTrimesterTips(week: number | null) {
  if (!week) return [];
  if (week <= 13) return PARTNER_TIPS[1] ?? [];
  if (week <= 26) return PARTNER_TIPS[2] ?? [];
  return PARTNER_TIPS[3] ?? [];
}

const WEEK_SIZE: Record<number, string> = {
  4: 'a poppy seed', 6: 'a lentil', 8: 'a raspberry',
  10: 'a strawberry', 12: 'a lime', 16: 'an avocado',
  20: 'a banana', 24: 'an ear of corn', 28: 'an eggplant',
  32: 'a squash', 36: 'a head of romaine', 40: 'a watermelon',
};

function getBabySize(week: number | null): string {
  if (!week) return 'tiny';
  const milestones = Object.keys(WEEK_SIZE).map(Number).sort((a, b) => a - b);
  const closest = milestones.reduce((prev, cur) => (Math.abs(cur - week) < Math.abs(prev - week) ? cur : prev));
  return WEEK_SIZE[closest];
}

const MOOD_EMOJI = ['', '😔', '😕', '😐', '🙂', '😊'];

export default function PartnerHome() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { view, viewStatus } = useAppSelector((s) => s.partner);

  useEffect(() => { dispatch(loadPartnerView()); }, [dispatch]);

  const week  = view?.currentWeek ?? null;
  const tips  = getTrimesterTips(week);
  const size  = getBabySize(week);
  const moods = view?.recentMoods ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Bloom Partner</Text>
        <TouchableOpacity onPress={() => dispatch(logout())} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {viewStatus === 'loading' && (
        <ActivityIndicator color="#CC6E9A" style={{ marginTop: 40 }} />
      )}

      {viewStatus !== 'loading' && !view && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No partner link found</Text>
          <Text style={styles.emptySub}>Ask the primary user to generate a new invite code.</Text>
        </View>
      )}

      {view && (
        <>
          {/* Hero week card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroWeekLabel}>Week</Text>
            <Text style={styles.heroWeek}>{week ?? '–'}</Text>
            <Text style={styles.heroSize}>Baby is about the size of {size} 🤰</Text>
            {view.dueDate && (
              <Text style={styles.heroDue}>
                Due {new Date(view.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            )}
          </View>

          {/* Mood (privacy-gated) */}
          {view.privacy?.shareMood && moods.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Mood</Text>
              <View style={styles.moodRow}>
                {moods.slice(0, 5).map((m, i) => (
                  <View key={i} style={styles.moodDot}>
                    <Text style={styles.moodEmoji}>{MOOD_EMOJI[m.mood_score] ?? '😐'}</Text>
                    <Text style={styles.moodDate}>
                      {new Date(m.logged_at).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Partner tips */}
          {tips.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>How to help this week</Text>
              {tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>💜</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick links */}
          <View style={styles.quickRow}>
            {[
              { label: 'Weekly\nUpdates', icon: '📅', route: '/(partner)/updates' as const },
              { label: 'Hospital\nChecklist', icon: '🏥', route: '/(partner)/checklist' as const },
              { label: 'Baby\nNames', icon: '💕', route: '/(partner)/names' as const },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.quickCard}
                onPress={() => router.push(item.route)}
                activeOpacity={0.8}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#FDF0F8' },
  content:     { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logo:        { fontSize: 24, fontWeight: '800', color: '#CC6E9A' },
  logoutBtn:   { padding: 6 },
  logoutText:  { color: '#A8997F', fontSize: 13 },

  emptyCard:   { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 40 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#3D1440', marginBottom: 8 },
  emptySub:    { color: '#8A7359', textAlign: 'center', lineHeight: 20 },

  heroCard:    {
    backgroundColor: '#CC6E9A', borderRadius: 24, padding: 28,
    alignItems: 'center', marginBottom: 20,
  },
  heroWeekLabel: { color: '#FFE8F3', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  heroWeek:    { color: '#FFFFFF', fontSize: 64, fontWeight: '900', lineHeight: 70 },
  heroSize:    { color: '#FFE8F3', fontSize: 15, marginTop: 8, textAlign: 'center' },
  heroDue:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 },

  card:        { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 16 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: '#3D1440', marginBottom: 12 },

  moodRow:     { flexDirection: 'row', justifyContent: 'space-around' },
  moodDot:     { alignItems: 'center', gap: 4 },
  moodEmoji:   { fontSize: 24 },
  moodDate:    { fontSize: 11, color: '#A8997F' },

  tipRow:      { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  tipBullet:   { fontSize: 16 },
  tipText:     { flex: 1, color: '#5A4636', lineHeight: 20, fontSize: 14 },

  quickRow:    { flexDirection: 'row', gap: 12, marginTop: 4 },
  quickCard:   {
    flex: 1, backgroundColor: '#FFFDF9', borderRadius: 16,
    padding: 16, alignItems: 'center', gap: 8,
  },
  quickIcon:   { fontSize: 28 },
  quickLabel:  { fontSize: 12, fontWeight: '600', color: '#3D1440', textAlign: 'center' },
});
