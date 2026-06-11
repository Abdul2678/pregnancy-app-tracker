// app/(partner)/updates.tsx
// Weekly development update for partner.

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadPartnerView } from '../../store/partnerSlice';

const TRIMESTER_INFO: Record<number, { title: string; partnerEd: string[] }> = {
  1: {
    title: 'First Trimester (Weeks 1–13)',
    partnerEd: [
      'Fatigue is one of the most intense symptoms — your partner may need 10+ hours of sleep.',
      'Morning sickness can hit at any time of day. Keep a bag in the car.',
      'The baby\'s heart starts beating around week 6 — you may hear it at the first scan.',
      'Avoid strong food smells if possible — sensitivity is very real.',
      'Emotional highs and lows are normal. Just listen, don\'t fix.',
    ],
  },
  2: {
    title: 'Second Trimester (Weeks 14–26)',
    partnerEd: [
      'Energy usually returns — enjoy this golden period together.',
      'Baby movements ("quickening") typically begin around week 18–20.',
      'The anatomy scan happens around week 20 — try to attend if possible.',
      'Back pain may start as the bump grows — offer massages.',
      'Talk to the baby! They can hear voices from around week 18.',
    ],
  },
  3: {
    title: 'Third Trimester (Weeks 27–40)',
    partnerEd: [
      'Sleep becomes harder — help create a comfortable sleeping environment.',
      'Braxton Hicks contractions are normal practice contractions.',
      'Pack the hospital bag together by week 35.',
      'Learn the signs of labour and have your route to hospital planned.',
      'Be present and reassuring — birth anxiety is common and valid.',
    ],
  },
};

function getTrimester(week: number | null): number {
  if (!week || week <= 13) return 1;
  if (week <= 26) return 2;
  return 3;
}

export default function PartnerUpdates() {
  const dispatch = useAppDispatch();
  const { view, viewStatus } = useAppSelector((s) => s.partner);

  useEffect(() => { dispatch(loadPartnerView()); }, [dispatch]);

  const week      = view?.currentWeek ?? null;
  const trimester = getTrimester(week);
  const info      = TRIMESTER_INFO[trimester];
  const weekData  = view?.weekContent;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>This Week</Text>

      {viewStatus === 'loading' && <ActivityIndicator color="#CC6E9A" style={{ marginTop: 40 }} />}

      {!view && viewStatus !== 'loading' && (
        <Text style={styles.empty}>No pregnancy data available yet.</Text>
      )}

      {view && (
        <>
          {/* Week header */}
          <View style={styles.weekCard}>
            <Text style={styles.weekNum}>Week {week ?? '–'}</Text>
            <Text style={styles.trimLabel}>{info.title}</Text>
          </View>

          {/* Baby development from API */}
          {weekData?.babyDevelopment && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Baby Development</Text>
              <Text style={styles.cardText}>{weekData.babyDevelopment}</Text>
            </View>
          )}

          {/* Body changes */}
          {weekData?.bodyChanges && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>What's Happening for Your Partner</Text>
              <Text style={styles.cardText}>{weekData.bodyChanges}</Text>
            </View>
          )}

          {/* Partner education */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Partner Education</Text>
            <Text style={styles.cardSub}>Things to know and do this trimester</Text>
            {info.partnerEd.map((tip, i) => (
              <View key={i} style={styles.eduRow}>
                <View style={styles.eduBullet}><Text style={styles.eduNum}>{i + 1}</Text></View>
                <Text style={styles.eduText}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Tips for this week from API */}
          {weekData?.partnerTip && (
            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Tip for this week</Text>
              <Text style={styles.highlightText}>{weekData.partnerTip}</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#FDF0F8' },
  content:      { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title:        { fontSize: 28, fontWeight: '800', color: '#3D1440', marginBottom: 20 },
  empty:        { color: '#A8997F', textAlign: 'center', marginTop: 40 },

  weekCard:     {
    backgroundColor: '#CC6E9A', borderRadius: 20, padding: 24,
    marginBottom: 20,
  },
  weekNum:      { fontSize: 36, fontWeight: '900', color: '#FFFFFF' },
  trimLabel:    { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },

  card:         { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 16 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: '#3D1440', marginBottom: 4 },
  cardSub:      { fontSize: 13, color: '#A8997F', marginBottom: 14 },
  cardText:     { fontSize: 14, color: '#5A4636', lineHeight: 22 },

  eduRow:       { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  eduBullet:    {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FDF0F8', alignItems: 'center', justifyContent: 'center',
  },
  eduNum:       { fontSize: 12, fontWeight: '700', color: '#CC6E9A' },
  eduText:      { flex: 1, fontSize: 14, color: '#5A4636', lineHeight: 20 },

  highlightCard: {
    backgroundColor: '#8E72B8', borderRadius: 16, padding: 18, marginBottom: 16,
  },
  highlightLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  highlightText:  { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
});
