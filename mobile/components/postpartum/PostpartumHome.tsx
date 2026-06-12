// components/postpartum/PostpartumHome.tsx
// Postpartum home screen — replaces the pregnancy home once a birth is logged.

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  loadPostpartumProfile, loadTodaySummary, loadNewbornWeek, checkMoodGap,
} from '../../store/postpartumSlice';

// ── Static newborn development by week (0-12) ───────────────────────────────

const NEWBORN_DEV: Record<number, string[]> = {
  0: ['Recognises your voice and smell', 'Sees about 20-30cm — exactly the distance to your face when feeding', 'Sleeps 16-18 hours a day in short stretches'],
  1: ['Startle (Moro) reflex is strong', 'May lose a little weight — normal in week 1', 'Grips your finger tightly'],
  2: ['Regaining birth weight around now', 'Cluster feeding is common and normal', 'Brief alert periods are growing longer'],
  3: ['Starting to focus on faces', 'May have a fussy period in the evenings', 'Neck strength slowly building'],
  4: ['May follow objects briefly with eyes', 'Recognises familiar voices', 'First social smiles can appear any day now'],
  6: ['Social smiles!', 'Cooing sounds begin', 'Sleep may start to organise into longer night stretches'],
  8: ['Holds head up during tummy time', 'Smiles back at you reliably', 'Discovers their hands'],
  10: ['Pushes up on arms during tummy time', 'Laughs and squeals', 'Tracks objects smoothly'],
  12: ['May roll from tummy to back', 'Reaches for toys', 'Babbles with vowel sounds'],
};

function getDevForWeek(week: number): string[] {
  const keys = Object.keys(NEWBORN_DEV).map(Number).sort((a, b) => a - b);
  let best = 0;
  for (const k of keys) if (k <= week) best = k;
  return NEWBORN_DEV[best];
}

// ── Mom recovery snippets by day/week ───────────────────────────────────────

function getRecoverySnippet(day: number, birthType: string | null): string {
  const cs = birthType === 'c_section';
  if (day <= 3) return cs
    ? 'The first days after a c-section are about rest and gentle movement. Short walks help prevent clots — but no lifting heavier than your baby.'
    : 'Bleeding (lochia) is heaviest now. Rest as much as you can, use maternity pads, and take pain relief as advised.';
  if (day <= 7) return cs
    ? 'Your incision is starting to heal. Keep it clean and dry, and watch for redness or discharge. Pain should slowly ease each day.'
    : 'Soreness and afterpains are normal. Warm sitz baths can soothe perineal stitches. Bleeding should be slowing down.';
  if (day <= 14) return cs
    ? 'Around now most people feel a turning point. Still no driving or heavy lifting — your core is healing from the inside out.'
    : 'Bleeding is lighter now. Gentle pelvic floor exercises can begin if you feel ready.';
  if (day <= 28) return 'Energy comes back in waves. Sleep deprivation peaks around now — sleep when the baby sleeps is real advice, not a cliché.';
  if (day <= 42) return 'Approaching your 6-week check. Note any questions for the doctor — bleeding, mood, pain, and contraception are all worth discussing.';
  return 'Past the 6-week mark. Recovery continues for months — be patient with your body and keep up the pelvic floor work.';
}

const MOOD_EMOJI = ['😔', '😕', '😐', '🙂', '😊'];

// ── Component ───────────────────────────────────────────────────────────────

export function PostpartumHome() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const { profile, todaySummary, moodGapDays, status } = useAppSelector((s) => s.postpartum);

  useEffect(() => {
    dispatch(loadTodaySummary());
    dispatch(checkMoodGap());
    if (profile) dispatch(loadNewbornWeek(Math.min(profile.babyAgeWeeks ?? 0, 12)));
  }, [dispatch, profile?.babyAgeWeeks]);

  if (!profile) return null;

  const name     = profile.baby_name || 'Your baby';
  const ageDays  = profile.babyAgeDays ?? 0;
  const ageWeeks = profile.babyAgeWeeks ?? 0;
  const dev      = getDevForWeek(ageWeeks);
  const recovery = getRecoverySnippet(ageDays, profile.birth_type);
  const showSixWeek = ageDays >= 42 && ageDays <= 70;
  const showMoodNudge = (moodGapDays ?? 0) >= 3;

  const ageLabel = ageDays === 0 ? 'born today! 🎉'
    : ageDays < 14 ? `${ageDays} day${ageDays === 1 ? '' : 's'} old`
    : `${ageWeeks} weeks old`;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading'}
            onRefresh={() => { dispatch(loadPostpartumProfile()); dispatch(loadTodaySummary()); }}
            tintColor="#CC6E9A"
          />
        }
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>👶</Text>
          <Text style={s.heroName}>{name}</Text>
          <Text style={s.heroAge}>is {ageLabel}</Text>
        </View>

        {/* Mood nudge — gentle check-in if no mood log in 3+ days */}
        {showMoodNudge && (
          <TouchableOpacity style={s.nudgeCard} activeOpacity={0.85}
            onPress={() => router.push('/features/mental-health' as any)}>
            <Text style={s.nudgeEmoji}>💜</Text>
            <View style={s.nudgeBody}>
              <Text style={s.nudgeTitle}>How are YOU doing?</Text>
              <Text style={s.nudgeText}>You haven't checked in for a few days. Taking 30 seconds for yourself matters too.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8E72B8" />
          </TouchableOpacity>
        )}

        {/* 6-week check-in banner */}
        {showSixWeek && (
          <TouchableOpacity style={s.sixWeekCard} activeOpacity={0.85}
            onPress={() => router.push('/features/six-week-checkin' as any)}>
            <Text style={s.sixWeekEmoji}>🩺</Text>
            <View style={s.nudgeBody}>
              <Text style={s.sixWeekTitle}>Your 6-week check-in is here</Text>
              <Text style={s.sixWeekText}>Complete a wellbeing check and get a summary for your GP appointment.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Quick-log row */}
        <Text style={s.sectionTitle}>Quick Log</Text>
        <View style={s.quickRow}>
          {[
            { label: 'Feed',   emoji: '🍼', type: 'feeding' },
            { label: 'Sleep',  emoji: '😴', type: 'sleep' },
            { label: 'Diaper', emoji: '🧷', type: 'diaper' },
            { label: 'Mood',   emoji: '💜', type: 'mood' },
          ].map((q) => (
            <TouchableOpacity
              key={q.type}
              style={s.quickCard}
              activeOpacity={0.8}
              onPress={() =>
                q.type === 'mood'
                  ? router.push('/features/mental-health' as any)
                  : router.push({ pathname: '/features/newborn-tracker' as any, params: { tab: q.type } })
              }
            >
              <Text style={s.quickEmoji}>{q.emoji}</Text>
              <Text style={s.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today summary */}
        {todaySummary && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Today</Text>
              <TouchableOpacity onPress={() => router.push('/features/newborn-tracker' as any)}>
                <Text style={s.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statNum}>{todaySummary.feeds.count}</Text>
                <Text style={s.statLabel}>feeds</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statNum}>{todaySummary.sleep.totalHours}h</Text>
                <Text style={s.statLabel}>sleep</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statNum}>{todaySummary.diapers.total}</Text>
                <Text style={s.statLabel}>diapers</Text>
              </View>
            </View>
          </View>
        )}

        {/* Mom recovery */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Your Recovery — Day {ageDays}</Text>
            <TouchableOpacity onPress={() => router.push('/features/mom-recovery' as any)}>
              <Text style={s.seeAll}>Guide →</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.cardText}>{recovery}</Text>
        </View>

        {/* Baby development */}
        <View style={s.card}>
          <Text style={s.cardTitle}>What {name} can do at {ageDays < 14 ? `${ageDays} days` : `${ageWeeks} weeks`}</Text>
          {dev.map((d, i) => (
            <View key={i} style={s.devRow}>
              <Text style={s.devDot}>✨</Text>
              <Text style={s.devText}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#FDF0F8' },
  scroll:      { padding: 20, paddingTop: 12 },

  hero:        { backgroundColor: '#CC6E9A', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20 },
  heroEmoji:   { fontSize: 44, marginBottom: 8 },
  heroName:    { fontSize: 30, fontWeight: '900', color: '#FFFFFF' },
  heroAge:     { fontSize: 16, color: '#FFE8F3', marginTop: 4 },

  nudgeCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F1EAFA', borderRadius: 16, padding: 16, marginBottom: 14 },
  nudgeEmoji:  { fontSize: 26 },
  nudgeBody:   { flex: 1 },
  nudgeTitle:  { fontSize: 14, fontWeight: '800', color: '#3D1440' },
  nudgeText:   { fontSize: 12, color: '#5A4636', marginTop: 2, lineHeight: 17 },

  sixWeekCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#8E72B8', borderRadius: 16, padding: 16, marginBottom: 14 },
  sixWeekEmoji: { fontSize: 26 },
  sixWeekTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  sixWeekText:  { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 17 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#A8997F', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  quickRow:    { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickCard:   { flex: 1, backgroundColor: '#FFFDF9', borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 6 },
  quickEmoji:  { fontSize: 24 },
  quickLabel:  { fontSize: 12, fontWeight: '700', color: '#3D1440' },

  card:        { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 16 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:   { fontSize: 15, fontWeight: '800', color: '#3D1440', flex: 1, paddingRight: 8 },
  seeAll:      { fontSize: 13, fontWeight: '700', color: '#CC6E9A' },
  cardText:    { fontSize: 14, color: '#5A4636', lineHeight: 21 },

  statRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stat:        { alignItems: 'center', flex: 1 },
  statNum:     { fontSize: 26, fontWeight: '900', color: '#CC6E9A' },
  statLabel:   { fontSize: 12, color: '#A8997F', marginTop: 2 },
  statDivider: { width: 1, height: 34, backgroundColor: '#F4EFE9' },

  devRow:      { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  devDot:      { fontSize: 13 },
  devText:     { flex: 1, fontSize: 14, color: '#5A4636', lineHeight: 20 },
});
