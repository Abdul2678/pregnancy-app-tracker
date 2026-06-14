// app/(tabs)/index.tsx
// Bloom Home Screen — 7 sections with skeleton loaders, empty states, quick-log bottom sheets.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  RefreshControl,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchWeekContent,
  fetchUpcomingAppointments,
  fetchCommunityHighlight,
  fetchUnreadCount,
  refreshHome,
} from '../../store/homeSlice';
import { fetchDailyTip } from '../../store/profileSlice';
import api from '../../lib/api';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import {
  HeroSkeleton,
  TipSkeleton,
  QuickLogSkeleton,
  DevelopmentSkeleton,
  UpcomingSkeleton,
  CommunitySkeleton,
} from '../../components/home/Skeleton';
import { PostpartumHome } from '../../components/postpartum/PostpartumHome';
import { loadPostpartumProfile } from '../../store/postpartumSlice';

// ─── Baby size lookup (weeks 4-40) ────────────────────────────────────────────

const BABY_SIZE: Record<number, { fruit: string; emoji: string; weightG: number; lengthCm: number }> = {
  4:  { fruit: 'poppy seed',       emoji: '🌱', weightG: 0,    lengthCm: 0.1  },
  5:  { fruit: 'sesame seed',      emoji: '🫘', weightG: 0,    lengthCm: 0.13 },
  6:  { fruit: 'lentil',           emoji: '🫘', weightG: 0,    lengthCm: 0.6  },
  7:  { fruit: 'blueberry',        emoji: '🫐', weightG: 0,    lengthCm: 1.0  },
  8:  { fruit: 'raspberry',        emoji: '🍇', weightG: 1,    lengthCm: 1.6  },
  9:  { fruit: 'cherry',           emoji: '🍒', weightG: 2,    lengthCm: 2.3  },
  10: { fruit: 'strawberry',       emoji: '🍓', weightG: 4,    lengthCm: 3.1  },
  11: { fruit: 'lime',             emoji: '🍋', weightG: 7,    lengthCm: 4.1  },
  12: { fruit: 'plum',             emoji: '🍑', weightG: 14,   lengthCm: 5.4  },
  13: { fruit: 'peach',            emoji: '🍑', weightG: 23,   lengthCm: 7.4  },
  14: { fruit: 'lemon',            emoji: '🍋', weightG: 43,   lengthCm: 8.7  },
  15: { fruit: 'apple',            emoji: '🍎', weightG: 70,   lengthCm: 10.1 },
  16: { fruit: 'avocado',          emoji: '🥑', weightG: 100,  lengthCm: 11.6 },
  17: { fruit: 'pear',             emoji: '🍐', weightG: 140,  lengthCm: 13.0 },
  18: { fruit: 'bell pepper',      emoji: '🫑', weightG: 190,  lengthCm: 14.2 },
  19: { fruit: 'mango',            emoji: '🥭', weightG: 240,  lengthCm: 15.3 },
  20: { fruit: 'banana',           emoji: '🍌', weightG: 300,  lengthCm: 25.6 },
  21: { fruit: 'carrot',           emoji: '🥕', weightG: 360,  lengthCm: 26.7 },
  22: { fruit: 'papaya',           emoji: '🍈', weightG: 430,  lengthCm: 27.8 },
  23: { fruit: 'grapefruit',       emoji: '🍊', weightG: 501,  lengthCm: 28.9 },
  24: { fruit: 'ear of corn',      emoji: '🌽', weightG: 600,  lengthCm: 30.0 },
  25: { fruit: 'cauliflower',      emoji: '🥦', weightG: 660,  lengthCm: 34.6 },
  26: { fruit: 'lettuce head',     emoji: '🥬', weightG: 760,  lengthCm: 35.6 },
  27: { fruit: 'broccoli head',    emoji: '🥦', weightG: 875,  lengthCm: 36.6 },
  28: { fruit: 'eggplant',         emoji: '🍆', weightG: 1005, lengthCm: 37.6 },
  29: { fruit: 'butternut squash', emoji: '🎃', weightG: 1153, lengthCm: 38.6 },
  30: { fruit: 'cabbage',          emoji: '🥬', weightG: 1319, lengthCm: 39.9 },
  31: { fruit: 'coconut',          emoji: '🥥', weightG: 1502, lengthCm: 41.1 },
  32: { fruit: 'jicama',           emoji: '🫙', weightG: 1702, lengthCm: 42.4 },
  33: { fruit: 'pineapple',        emoji: '🍍', weightG: 1918, lengthCm: 43.7 },
  34: { fruit: 'cantaloupe',       emoji: '🍈', weightG: 2146, lengthCm: 45.0 },
  35: { fruit: 'honeydew melon',   emoji: '🍈', weightG: 2383, lengthCm: 46.2 },
  36: { fruit: 'romaine head',     emoji: '🥬', weightG: 2622, lengthCm: 47.4 },
  37: { fruit: 'winter melon',     emoji: '🍉', weightG: 2859, lengthCm: 48.6 },
  38: { fruit: 'leek',             emoji: '🌿', weightG: 3083, lengthCm: 49.8 },
  39: { fruit: 'watermelon',       emoji: '🍉', weightG: 3288, lengthCm: 50.7 },
  40: { fruit: 'small pumpkin',    emoji: '🎃', weightG: 3462, lengthCm: 51.2 },
};

function getBabySize(week: number) {
  const clamped = Math.min(40, Math.max(4, week));
  return BABY_SIZE[clamped] ?? BABY_SIZE[12];
}

// ─── Milestone lookup ─────────────────────────────────────────────────────────

const MILESTONES: Record<number, string> = {
  8:  'First heartbeat audible',
  12: 'End of first trimester',
  16: 'Possible gender reveal',
  18: 'Anatomy scan window',
  20: 'Halfway there!',
  24: 'Viability milestone',
  28: 'Third trimester begins',
  32: 'Baby turns head-down',
  36: 'Full-term countdown',
  37: 'Early term — lung maturity',
  40: 'Due date!',
};

function getNextMilestone(currentWeek: number) {
  const weeks = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b);
  const next = weeks.find((w) => w > currentWeek);
  if (!next) return null;
  return { week: next, label: MILESTONES[next], weeksAway: next - currentWeek };
}

// ─── SVG horseshoe progress arc (240° sweep, start 150°) ─────────────────────

function ProgressArc({ progress, week }: { progress: number; week: number }) {
  const SIZE = 120;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const px = (d: number) => cx + R * Math.cos(toRad(d));
  const py = (d: number) => cy + R * Math.sin(toRad(d));

  const startDeg = 150;
  const sweepDeg = 240;
  const trackEnd = startDeg + sweepDeg;

  // Full track path
  const trackPath = [
    `M ${px(startDeg)} ${py(startDeg)}`,
    `A ${R} ${R} 0 1 1 ${px(trackEnd - 0.01)} ${py(trackEnd - 0.01)}`,
  ].join(' ');

  // Filled portion
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const endDeg = startDeg + sweepDeg * clampedProgress;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const fillPath =
    clampedProgress > 0
      ? `M ${px(startDeg)} ${py(startDeg)} A ${R} ${R} 0 ${large} 1 ${px(endDeg)} ${py(endDeg)}`
      : '';

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Path d={trackPath} stroke={colors.border} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        {fillPath ? (
          <Path d={fillPath} stroke={colors.rose} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        ) : null}
      </Svg>
      <Text style={arcS.week}>{week}</Text>
      <Text style={arcS.label}>weeks</Text>
    </View>
  );
}

const arcS = StyleSheet.create({
  week:  { fontSize: 30, fontWeight: '800', color: colors.textDeep, letterSpacing: -1 },
  label: { fontSize: 11, color: colors.textMuted, marginTop: -2, fontWeight: '600' },
});

// ─── Quick-log chip definitions ───────────────────────────────────────────────

interface LogChip { id: string; icon: string; label: string; bg: string }

const LOG_CHIPS: LogChip[] = [
  { id: 'symptom', icon: '💊', label: 'Symptom', bg: colors.roseLight },
  { id: 'mood',    icon: '😊', label: 'Mood',    bg: colors.lavenderLight },
  { id: 'weight',  icon: '⚖️',  label: 'Weight',  bg: '#E8F5ED' },
  { id: 'kick',    icon: '👶', label: 'Kick',    bg: '#FFF3E0' },
  { id: 'water',   icon: '💧', label: 'Water',   bg: '#E3F2FD' },
];

// ─── Quick-log bottom sheet ───────────────────────────────────────────────────

function QuickLogSheet({ chip, onClose }: { chip: LogChip | null; onClose: () => void }) {
  const slideY = useRef(new Animated.Value(400)).current;
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (chip) {
      setValue('');
      setSaved(false);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
    }
  }, [chip]);

  function close() {
    Animated.timing(slideY, { toValue: 400, duration: 220, useNativeDriver: true }).start(() => onClose());
  }

  async function save() {
    if (!chip) return;
    setSaving(true);
    try {
      const endpoints: Record<string, string> = {
        symptom: '/symptoms',
        mood:    '/mood',
        weight:  '/weight',
        kick:    '/kicks',
        water:   '/water',
      };
      const bodies: Record<string, object> = {
        symptom: { symptom_name: value || 'general', severity: 'mild' },
        mood:    { mood: value || 'okay' },
        weight:  { weight_kg: parseFloat(value) || 0 },
        kick:    { count: parseInt(value, 10) || 1 },
        water:   { glasses: parseInt(value, 10) || 1 },
      };
      await api.post(endpoints[chip.id], bodies[chip.id]);
      setSaved(true);
      setTimeout(close, 900);
    } catch {
      close();
    } finally {
      setSaving(false);
    }
  }

  if (!chip) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <TouchableOpacity style={sh.overlay} activeOpacity={1} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={sh.kav}>
        <Animated.View style={[sh.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={sh.handle} />
          <View style={sh.row}>
            <Text style={sh.emoji}>{chip.icon}</Text>
            <Text style={sh.title}>Log {chip.label}</Text>
          </View>

          {chip.id === 'mood' ? (
            <View style={sh.moodRow}>
              {['😔', '😐', '🙂', '😊', '😄'].map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[sh.moodBtn, value === e && sh.moodActive]}
                  onPress={() => setValue(e)}
                >
                  <Text style={{ fontSize: 28 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={sh.input}
              placeholder={
                chip.id === 'symptom' ? 'e.g. nausea, backache…' :
                chip.id === 'weight'  ? 'Weight in kg' :
                chip.id === 'kick'    ? 'Number of kicks' : 'Glasses of water'
              }
              placeholderTextColor={colors.textLight}
              value={value}
              onChangeText={setValue}
              keyboardType={['weight', 'kick', 'water'].includes(chip.id) ? 'decimal-pad' : 'default'}
              autoFocus
            />
          )}

          <TouchableOpacity
            style={[sh.saveBtn, saved && sh.savedBtn]}
            onPress={save}
            disabled={saving || saved}
          >
            <Text style={sh.saveTxt}>{saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sh = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  kav:      { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:    { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 44 },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  emoji:    { fontSize: 24, marginRight: 10 },
  title:    { fontSize: 20, fontWeight: '700', color: colors.textDeep },
  moodRow:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  moodBtn:  { padding: 8, borderRadius: radius.md, backgroundColor: colors.bgWarm },
  moodActive: { backgroundColor: colors.roseLight, borderWidth: 2, borderColor: colors.rose },
  input:    { backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.textDeep, marginBottom: spacing.md },
  saveBtn:  { backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center' },
  savedBtn: { backgroundColor: colors.success },
  saveTxt:  { color: colors.white, fontWeight: '700', fontSize: 16 },
});

// ─── Expandable tip card ──────────────────────────────────────────────────────

const CAT_BG: Record<string, string> = {
  nutrition: '#E8F5ED', movement: '#FFF3E0', sleep: colors.lavenderLight,
  mental: colors.roseLight, partner: '#E3F2FD',
};
const CAT_TXT: Record<string, string> = {
  nutrition: '#2E7D32', movement: '#E65100', sleep: colors.lavenderDark,
  mental: colors.roseDark, partner: '#0D47A1',
};

function TipCard({ tip }: { tip: any }) {
  const [expanded, setExpanded] = useState(false);
  if (!tip) return null;

  const cat   = typeof tip === 'object' ? (tip.category ?? 'general') : 'general';
  const title = typeof tip === 'string' ? tip : (tip.title ?? tip.text ?? '');
  const body  = typeof tip === 'object' ? (tip.body ?? tip.text ?? '') : '';

  return (
    <TouchableOpacity style={tp.card} activeOpacity={0.9} onPress={() => setExpanded((v) => !v)}>
      <View style={tp.header}>
        <View style={[tp.badge, { backgroundColor: CAT_BG[cat] ?? colors.roseLight }]}>
          <Text style={[tp.badgeTxt, { color: CAT_TXT[cat] ?? colors.roseDark }]}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </Text>
        </View>
        <View style={[tp.badge, { backgroundColor: colors.bgWarm }]}>
          <Text style={[tp.badgeTxt, { color: colors.textMuted }]}>Today's tip</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
      </View>
      <Text style={tp.title} numberOfLines={expanded ? undefined : 2}>{title}</Text>
      {expanded && body ? <Text style={tp.body}>{body}</Text> : null}
    </TouchableOpacity>
  );
}

const tp = StyleSheet.create({
  card:     { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md },
  header:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  badge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  title:    { fontSize: 15, fontWeight: '700', color: colors.textDeep, lineHeight: 22 },
  body:     { fontSize: 14, color: colors.textBody, lineHeight: 21, marginTop: 8 },
});

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const router   = useRouter();

  const postpartum = useAppSelector((s) => s.postpartum);
  const profile  = useAppSelector((s) => s.profile.profile);
  const dailyTip = useAppSelector((s) => s.profile.dailyTip);
  const { weekContent, appointments, communityPost, unreadNotifCount, loading, refreshing } =
    useAppSelector((s) => s.home);

  const currentWeek = profile?.currentWeek ?? 12;
  const dueDate     = profile?.dueDate;
  const firstName   = (profile as any)?.firstName ?? (profile as any)?.first_name ?? 'Mama';
  const [activeChip, setActiveChip] = useState<LogChip | null>(null);

  const daysLeft = dueDate
    ? Math.max(0, Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000))
    : null;

  const babySize  = getBabySize(currentWeek);
  const milestone = getNextMilestone(currentWeek);

  const devHighlights = weekContent?.development_highlights ?? weekContent?.developmentHighlights ?? [];
  const headline      = weekContent?.headlineSentence ?? '';
  const didYouKnow    = weekContent?.did_you_know ?? weekContent?.didYouKnow ?? '';

  useEffect(() => {
    dispatch(loadPostpartumProfile());
  }, [dispatch]);

  useEffect(() => {
    if (postpartum.active) return;
    dispatch(fetchWeekContent(currentWeek));
    dispatch(fetchUpcomingAppointments());
    dispatch(fetchCommunityHighlight());
    dispatch(fetchUnreadCount());
    dispatch(fetchDailyTip());
  }, [dispatch, currentWeek, postpartum.active]);

  const onRefresh = useCallback(() => {
    dispatch(refreshHome(currentWeek));
  }, [dispatch, currentWeek]);

  // Postpartum mode replaces the pregnancy home entirely
  if (postpartum.active && postpartum.profile) {
    return <PostpartumHome />;
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good {timeOfDay()} 👋</Text>
          <Text style={s.name}>{firstName}</Text>
        </View>
        <View style={s.hRight}>
          <TouchableOpacity style={s.bellWrap} onPress={() => router.push('/features/notifications' as any)}>
            <Ionicons name="notifications-outline" size={24} color={colors.textDeep} />
            {unreadNotifCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeTxt}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/(tabs)/profile' as any)}>
            <Text style={s.avatarTxt}>{firstName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.rose} colors={[colors.rose]} />
        }
      >
        {/* ── Birth logging banner (week 41+ or anytime via card) ─── */}
        {currentWeek >= 37 && (
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: currentWeek >= 41 ? colors.rose : '#FFFDF9',
              borderRadius: 16, padding: 16, marginBottom: 14,
              borderWidth: currentWeek >= 41 ? 0 : 1.5, borderColor: colors.rose,
            }}
            activeOpacity={0.85}
            onPress={() => router.push('/features/birth-log' as any)}
          >
            <Text style={{ fontSize: 26 }}>👶</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: currentWeek >= 41 ? '#FFFFFF' : colors.textDeep }}>
                {currentWeek >= 41 ? 'Has your baby arrived?' : 'Baby arrived early?'}
              </Text>
              <Text style={{ fontSize: 12, color: currentWeek >= 41 ? 'rgba(255,255,255,0.85)' : '#8A7359', marginTop: 2 }}>
                Log your birth to switch to postpartum mode
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={currentWeek >= 41 ? '#FFFFFF' : colors.rose} />
          </TouchableOpacity>
        )}

        {/* ── Hero card ───────────────────────────────────────────── */}
        {loading.weekContent && !weekContent ? <HeroSkeleton /> : (
          <View style={s.heroCard}>
            <View style={s.heroLeft}>
              <Text style={s.heroLabel}>You're in week</Text>
              <Text style={s.heroWeek}>{currentWeek}</Text>
              {daysLeft !== null && (
                <Text style={s.heroDays}>
                  <Text style={s.heroDaysBold}>{daysLeft}</Text> days until your due date
                </Text>
              )}
              <View style={s.sizeRow}>
                <Text style={{ fontSize: 26 }}>{babySize.emoji}</Text>
                <View>
                  <Text style={s.sizeLabel}>Size of a</Text>
                  <Text style={s.sizeFruit}>{babySize.fruit}</Text>
                </View>
              </View>
              {babySize.weightG > 0 && (
                <Text style={s.sizeMeasure}>~{babySize.weightG}g · {babySize.lengthCm}cm</Text>
              )}
            </View>
            <ProgressArc progress={currentWeek / 40} week={currentWeek} />
          </View>
        )}

        {/* ── Daily tip ───────────────────────────────────────────── */}
        {dailyTip ? <TipCard tip={dailyTip} /> : <TipSkeleton />}

        {/* ── Quick log ───────────────────────────────────────────── */}
        <Text style={s.secTitle}>Quick log</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {LOG_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.id}
              style={[s.chip, { backgroundColor: chip.bg }]}
              onPress={() => setActiveChip(chip)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>{chip.icon}</Text>
              <Text style={s.chipTxt}>+ {chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Baby development ────────────────────────────────────── */}
        <Text style={s.secTitle}>Baby development</Text>
        {loading.weekContent && !weekContent ? <DevelopmentSkeleton /> : weekContent ? (
          <View style={s.card}>
            {headline ? <Text style={s.devHeadline}>{headline}</Text> : null}
            {devHighlights.slice(0, 2).map((h, i) => (
              <View key={i} style={s.devRow}>
                <View style={s.devDot} />
                <Text style={s.devTxt}>
                  <Text style={s.devSys}>{h.system}: </Text>{h.detail}
                </Text>
              </View>
            ))}
            {didYouKnow ? (
              <View style={s.dyk}>
                <Text style={s.dykLabel}>Did you know?</Text>
                <Text style={s.dykTxt}>{didYouKnow}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.push('/features/week-detail' as any)}>
              <Text style={s.devLink}>See full week {currentWeek} update →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.card, s.emptyCard]}>
            <Text style={s.emptyEmoji}>🌱</Text>
            <Text style={s.emptyTxt}>Week content is being personalised for you.</Text>
          </View>
        )}

        {/* ── Upcoming ────────────────────────────────────────────── */}
        <Text style={s.secTitle}>Upcoming</Text>
        {loading.appointments && appointments.length === 0 ? <UpcomingSkeleton /> : (
          <View style={s.card}>
            {appointments.length === 0 && !milestone && (
              <View style={s.emptyRow}>
                <Ionicons name="calendar-outline" size={26} color={colors.textLight} />
                <Text style={s.emptyRowTxt}>No upcoming appointments.</Text>
              </View>
            )}
            {appointments.slice(0, 2).map((a) => (
              <View key={a.id} style={s.upRow}>
                <View style={[s.upIcon, { backgroundColor: colors.roseLight }]}>
                  <Ionicons name="medical-outline" size={20} color={colors.rose} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.upTitle}>{a.title}</Text>
                  <Text style={s.upSub}>{formatDate(a.scheduled_at)}</Text>
                  {a.location_name ? <Text style={s.upSub2}>{a.location_name}</Text> : null}
                </View>
              </View>
            ))}
            {milestone && (
              <View style={[s.upRow, appointments.length > 0 && s.upBorder]}>
                <View style={[s.upIcon, { backgroundColor: colors.lavenderLight }]}>
                  <Ionicons name="star-outline" size={20} color={colors.lavender} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.upTitle}>{milestone.label}</Text>
                  <Text style={s.upSub}>
                    Week {milestone.week} · {milestone.weeksAway} week{milestone.weeksAway !== 1 ? 's' : ''} away
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Community highlight ─────────────────────────────────── */}
        <Text style={s.secTitle}>Birth club</Text>
        {loading.community && !communityPost ? <CommunitySkeleton /> : communityPost ? (
          <View style={s.card}>
            <View style={s.commHeader}>
              <View style={s.commAvatar}>
                <Text style={s.commAvatarTxt}>
                  {(communityPost.display_name ?? 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={s.commName}>{communityPost.display_name ?? 'Anonymous'}</Text>
              <Text style={s.commTime}>{timeAgo(communityPost.created_at)}</Text>
            </View>
            <Text style={s.commTitle}>{communityPost.title}</Text>
            <Text style={s.commBody} numberOfLines={2}>{communityPost.body}</Text>
            <View style={s.commFooter}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
              <Text style={s.commReplies}>{communityPost.reply_count ?? 0} replies</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/community' as any)}>
                <Text style={s.commJoin}>Join the conversation →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[s.card, s.emptyCard]}>
            <Text style={s.emptyEmoji}>💬</Text>
            <Text style={s.emptyTxt}>Be the first to post in your birth club!</Text>
            <TouchableOpacity style={{ marginTop: 10 }} onPress={() => router.push('/(tabs)/community' as any)}>
              <Text style={s.commJoin}>Start a conversation →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {activeChip && <QuickLogSheet chip={activeChip} onClose={() => setActiveChip(null)} />}
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: spacing.sm },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  greeting:    { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  name:        { fontSize: 20, fontWeight: '800', color: colors.textDeep, letterSpacing: -0.5 },
  hRight:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellWrap:    { position: 'relative', padding: 4 },
  notifBadge:  { position: 'absolute', top: 0, right: 0, backgroundColor: colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeTxt: { color: colors.white, fontSize: 9, fontWeight: '800' },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { color: colors.white, fontWeight: '800', fontSize: 16 },

  // Hero card
  heroCard:     { ...shadow.md, backgroundColor: colors.surface, borderRadius: radius.xl, marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLeft:     { flex: 1, marginRight: spacing.md },
  heroLabel:    { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroWeek:     { fontSize: 52, fontWeight: '900', color: colors.textDeep, letterSpacing: -2, lineHeight: 58 },
  heroDays:     { fontSize: 13, color: colors.textBody, marginTop: 2 },
  heroDaysBold: { fontWeight: '700', color: colors.rose },
  sizeRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  sizeLabel:    { fontSize: 11, color: colors.textMuted },
  sizeFruit:    { fontSize: 14, fontWeight: '700', color: colors.textDeep },
  sizeMeasure:  { fontSize: 11, color: colors.textLight, marginTop: 4 },

  // Section title
  secTitle: { fontSize: 16, fontWeight: '800', color: colors.textDeep, marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.xs },

  // Quick log
  chips:   { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  chip:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, gap: 6 },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colors.textDeep },

  // Generic card
  card: { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, marginHorizontal: spacing.md, marginBottom: spacing.md, padding: spacing.md },

  // Development
  devHeadline: { fontSize: 15, fontWeight: '700', color: colors.textDeep, marginBottom: 10, lineHeight: 22 },
  devRow:      { flexDirection: 'row', marginBottom: 8, gap: 8 },
  devDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.rose, marginTop: 6 },
  devTxt:      { flex: 1, fontSize: 14, color: colors.textBody, lineHeight: 20 },
  devSys:      { fontWeight: '700', color: colors.textDeep },
  dyk:         { backgroundColor: colors.lavenderPale, borderRadius: radius.md, padding: spacing.sm, marginTop: 8 },
  dykLabel:    { fontSize: 10, fontWeight: '800', color: colors.lavender, textTransform: 'uppercase', letterSpacing: 0.5 },
  dykTxt:      { fontSize: 13, color: colors.textBody, marginTop: 3, lineHeight: 19 },
  devLink:     { fontSize: 14, fontWeight: '700', color: colors.rose },

  // Upcoming
  upRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  upBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 6, paddingTop: 12 },
  upIcon:   { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  upTitle:  { fontSize: 14, fontWeight: '700', color: colors.textDeep },
  upSub:    { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  upSub2:   { fontSize: 12, color: colors.textLight, marginTop: 1 },

  // Community
  commHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  commAvatar:    { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.lavenderLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  commAvatarTxt: { fontSize: 14, fontWeight: '700', color: colors.lavender },
  commName:      { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textDeep },
  commTime:      { fontSize: 12, color: colors.textLight },
  commTitle:     { fontSize: 15, fontWeight: '700', color: colors.textDeep, marginBottom: 4 },
  commBody:      { fontSize: 13, color: colors.textBody, lineHeight: 20 },
  commFooter:    { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  commReplies:   { flex: 1, fontSize: 12, color: colors.textMuted },
  commJoin:      { fontSize: 13, fontWeight: '700', color: colors.rose },

  // Empty states
  emptyCard:   { alignItems: 'center', paddingVertical: spacing.lg },
  emptyEmoji:  { fontSize: 32, marginBottom: 8 },
  emptyTxt:    { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  emptyRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: spacing.sm },
  emptyRowTxt: { fontSize: 14, color: colors.textMuted },
});
