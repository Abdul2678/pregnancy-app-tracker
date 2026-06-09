// app/(tabs)/track.tsx
// Bloom Tracking Screen — calendar strip, today's summary, 4 tiles, history.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Modal, Share, Animated, SafeAreaView, StatusBar,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchTodayLogs,
  fetchHistoryDots,
  fetchWeightHistory,
  fetchWeekSummary,
  fetchDayLog,
  setSelectedDate,
  clearSelectedDay,
  type DayDots,
  type SymptomLog,
  type MoodLog,
  type WeightLog,
} from '../../store/trackingSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import { SymptomLogger } from '../../components/tracking/SymptomLogger';
import { MoodLogger }    from '../../components/tracking/MoodLogger';
import { WeightLogger }  from '../../components/tracking/WeightLogger';

// ─── Calendar strip (14 days) ─────────────────────────────────────────────────

const DOT_COLORS = {
  symptom: colors.rose,
  mood:    colors.lavender,
  weight:  colors.success,
};

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function makeCalendarDays(): Array<{ date: string; label: string; dayLetter: string; isToday: boolean }> {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      label:     String(d.getDate()),
      dayLetter: DAY_LETTERS[d.getDay()],
      isToday:   i === 13,
    };
  });
}

function CalendarStrip({
  dots,
  selectedDate,
  onSelect,
}: {
  dots: DayDots[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const days = makeCalendarDays();
  const dotMap = new Map(dots.map((d) => [d.date, d]));

  return (
    <FlatList
      horizontal
      data={days}
      keyExtractor={(d) => d.date}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={cs.strip}
      renderItem={({ item: day }) => {
        const dot  = dotMap.get(day.date);
        const isSel = selectedDate === day.date;
        return (
          <TouchableOpacity
            style={[cs.dayBtn, day.isToday && cs.dayToday, isSel && cs.daySel]}
            onPress={() => onSelect(day.date)}
            activeOpacity={0.8}
          >
            <Text style={[cs.dayLetter, isSel && cs.dayTxtActive, day.isToday && cs.dayTxtToday]}>
              {day.dayLetter}
            </Text>
            <Text style={[cs.dayNum, isSel && cs.dayTxtActive, day.isToday && cs.dayNumToday]}>
              {day.label}
            </Text>
            <View style={cs.dotsRow}>
              {dot?.hasSymptom && <View style={[cs.dot, { backgroundColor: DOT_COLORS.symptom }]} />}
              {dot?.hasMood    && <View style={[cs.dot, { backgroundColor: DOT_COLORS.mood }]} />}
              {dot?.hasWeight  && <View style={[cs.dot, { backgroundColor: DOT_COLORS.weight }]} />}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const cs = StyleSheet.create({
  strip:       { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 4 },
  dayBtn:      { width: 46, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.bgWarm },
  dayToday:    { borderWidth: 2, borderColor: colors.rose },
  daySel:      { backgroundColor: colors.rose },
  dayLetter:   { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  dayNum:      { fontSize: 16, fontWeight: '800', color: colors.textDeep, marginVertical: 2 },
  dayNumToday: { color: colors.rose },
  dayTxtToday: { color: colors.rose },
  dayTxtActive:{ color: colors.white },
  dotsRow:     { flexDirection: 'row', gap: 2, height: 6, alignItems: 'center' },
  dot:         { width: 5, height: 5, borderRadius: 2.5 },
});

// ─── Today's summary card ─────────────────────────────────────────────────────

function TodaySummaryCard({
  symptoms,
  moods,
  weights,
}: {
  symptoms: SymptomLog[];
  moods: MoodLog[];
  weights: WeightLog[];
}) {
  const logged = symptoms.length + moods.length + weights.length;

  if (logged === 0) {
    return (
      <View style={[ts.card, ts.emptyCard]}>
        <Text style={ts.emptyEmoji}>📋</Text>
        <Text style={ts.emptyTxt}>Nothing logged yet today</Text>
        <Text style={ts.emptyHint}>Tap a tile below to start tracking</Text>
      </View>
    );
  }

  return (
    <View style={ts.card}>
      <Text style={ts.title}>Today's log</Text>
      <View style={ts.pillsRow}>
        {symptoms.length > 0 && (
          <View style={[ts.pill, { backgroundColor: colors.roseLight }]}>
            <Text style={[ts.pillTxt, { color: colors.roseDark }]}>
              💊 {symptoms.length} symptom{symptoms.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {moods.length > 0 && (
          <View style={[ts.pill, { backgroundColor: colors.lavenderLight }]}>
            <Text style={[ts.pillTxt, { color: colors.lavenderDark }]}>
              {moodEmoji(moods[0].moodScore)} {moods[0].mood}
            </Text>
          </View>
        )}
        {weights.length > 0 && (
          <View style={[ts.pill, { backgroundColor: colors.successLight }]}>
            <Text style={[ts.pillTxt, { color: colors.success }]}>
              ⚖️ {weights[0].weight_kg} kg
            </Text>
          </View>
        )}
      </View>
      {symptoms.length > 0 && symptoms[0].triage?.urgentFlag && (
        <View style={ts.urgentRow}>
          <Ionicons name="warning" size={14} color={colors.error} />
          <Text style={ts.urgentTxt}>
            {symptoms[0].triage?.recommendation}
          </Text>
        </View>
      )}
    </View>
  );
}

function moodEmoji(score: number): string {
  return ['😭', '😢', '😐', '🙂', '😄'][Math.min(4, Math.max(0, (score ?? 3) - 1))];
}

const ts = StyleSheet.create({
  card:       { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md },
  emptyCard:  { alignItems: 'center', paddingVertical: spacing.lg },
  emptyEmoji: { fontSize: 28, marginBottom: 6 },
  emptyTxt:   { fontSize: 15, fontWeight: '700', color: colors.textDeep, marginBottom: 4 },
  emptyHint:  { fontSize: 13, color: colors.textMuted },
  title:      { fontSize: 14, fontWeight: '800', color: colors.textDeep, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  pillTxt:    { fontSize: 13, fontWeight: '700' },
  urgentRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: colors.errorLight, borderRadius: radius.sm, padding: spacing.sm },
  urgentTxt:  { flex: 1, fontSize: 12, color: colors.error, lineHeight: 18 },
});

// ─── 4 quick-access tiles ─────────────────────────────────────────────────────

interface Tile {
  id: 'symptom' | 'mood' | 'weight' | 'body';
  icon: string;
  label: string;
  subtitle: string;
  bg: string;
  iconBg: string;
}

const TILES: Tile[] = [
  { id: 'symptom', icon: '💊', label: 'Symptoms',  subtitle: 'Physical & emotional', bg: colors.roseLight,    iconBg: colors.rose },
  { id: 'mood',    icon: '💜', label: 'Mood',       subtitle: 'How you\'re feeling',  bg: colors.lavenderLight, iconBg: colors.lavender },
  { id: 'weight',  icon: '⚖️',  label: 'Weight',    subtitle: 'Track your gain',      bg: colors.successLight,  iconBg: colors.success },
  { id: 'body',    icon: '💧', label: 'Body',       subtitle: 'Water & kicks',        bg: '#E3F2FD',            iconBg: '#1565C0' },
];

function TileGrid({ onPress }: { onPress: (id: Tile['id']) => void }) {
  return (
    <View style={tg.grid}>
      {TILES.map((tile) => (
        <TouchableOpacity
          key={tile.id}
          style={[tg.tile, { backgroundColor: tile.bg }]}
          onPress={() => onPress(tile.id)}
          activeOpacity={0.8}
        >
          <View style={[tg.iconWrap, { backgroundColor: tile.iconBg }]}>
            <Text style={{ fontSize: 20 }}>{tile.icon}</Text>
          </View>
          <Text style={tg.label}>{tile.label}</Text>
          <Text style={tg.sub}>{tile.subtitle}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tg = StyleSheet.create({
  grid:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  tile:    { width: '47.5%', borderRadius: radius.lg, padding: spacing.md, ...shadow.sm },
  iconWrap:{ width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  label:   { fontSize: 15, fontWeight: '800', color: colors.textDeep, marginBottom: 2 },
  sub:     { fontSize: 12, color: colors.textBody },
});

// ─── Weekly AI summary card ───────────────────────────────────────────────────

function WeekSummaryCard({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      style={ws.card}
      activeOpacity={0.9}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={ws.header}>
        <View style={ws.iconWrap}>
          <Text style={{ fontSize: 18 }}>🧠</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={ws.title}>Your week in review</Text>
          <Text style={ws.subtitle}>AI-generated pattern summary</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </View>
      <Text style={ws.text} numberOfLines={expanded ? undefined : 3}>{summary}</Text>
    </TouchableOpacity>
  );
}

const ws = StyleSheet.create({
  card:    { ...shadow.sm, backgroundColor: colors.surfacePurple, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.lavenderLight },
  header:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lavenderLight, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 14, fontWeight: '800', color: colors.textDeep },
  subtitle:{ fontSize: 11, color: colors.textMuted },
  text:    { fontSize: 14, color: colors.textBody, lineHeight: 21 },
});

// ─── Day log detail modal ─────────────────────────────────────────────────────

function DayLogModal({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const dispatch    = useAppDispatch();
  const selectedLog = useAppSelector((s) => s.tracking.selectedDayLog);
  const loading     = useAppSelector((s) => s.tracking.status === 'loading');

  useEffect(() => {
    dispatch(fetchDayLog(date));
  }, [date]);

  const friendly = (() => {
    try { return new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
    catch { return date; }
  })();

  async function exportDay() {
    if (!selectedLog) return;
    const lines: string[] = [`📋 Log for ${friendly}`, ''];
    if (selectedLog.symptoms.length > 0) {
      lines.push('Symptoms:');
      selectedLog.symptoms.forEach((s) => lines.push(`  • ${s.symptoms.join(', ')} (severity ${s.severity}/5)`));
    }
    if (selectedLog.moods.length > 0) {
      lines.push('', 'Mood:');
      selectedLog.moods.forEach((m) => lines.push(`  • ${m.mood} (${m.moodScore}/5)${m.note ? ` — "${m.note}"` : ''}`));
    }
    if (selectedLog.weights.length > 0) {
      lines.push('', 'Weight:');
      selectedLog.weights.forEach((w) => lines.push(`  • ${w.weight_kg} kg / ${w.weight_lbs} lbs`));
    }
    lines.push('', `Exported from Bloom 🌸`);
    await Share.share({ message: lines.join('\n'), title: `Bloom log — ${friendly}` });
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible onRequestClose={onClose}>
      <SafeAreaView style={dl.safe}>
        <View style={dl.header}>
          <Text style={dl.title}>{friendly}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={dl.iconBtn} onPress={exportDay}>
              <Ionicons name="share-outline" size={20} color={colors.rose} />
            </TouchableOpacity>
            <TouchableOpacity style={dl.iconBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {loading ? (
            <ActivityIndicator color={colors.rose} style={{ marginTop: 40 }} />
          ) : !selectedLog || (
            selectedLog.symptoms.length === 0 &&
            selectedLog.moods.length    === 0 &&
            selectedLog.weights.length  === 0
          ) ? (
            <View style={dl.empty}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
              <Text style={dl.emptyTxt}>Nothing was logged on this day.</Text>
            </View>
          ) : (
            <>
              {selectedLog.symptoms.length > 0 && (
                <View style={dl.section}>
                  <Text style={dl.sectionTitle}>💊 Symptoms</Text>
                  {selectedLog.symptoms.map((sym, i) => (
                    <View key={i} style={dl.logRow}>
                      <View style={dl.logDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={dl.logMain}>{sym.symptoms.join(', ')}</Text>
                        <Text style={dl.logSub}>Severity {sym.severity}/5{sym.note ? ` · "${sym.note}"` : ''}</Text>
                        {sym.triage && (
                          <Text style={[dl.triage, sym.triage.urgentFlag && dl.triageUrgent]}>
                            {sym.triage.urgentFlag ? '⚠️ ' : '✅ '}{sym.triage.recommendation}
                          </Text>
                        )}
                      </View>
                      <Text style={dl.time}>{shortTime(sym.logged_at)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedLog.moods.length > 0 && (
                <View style={dl.section}>
                  <Text style={dl.sectionTitle}>💜 Mood</Text>
                  {selectedLog.moods.map((m, i) => (
                    <View key={i} style={dl.logRow}>
                      <View style={[dl.logDot, { backgroundColor: colors.lavender }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={dl.logMain}>{moodEmoji(m.moodScore)} {m.mood}</Text>
                        {m.note ? <Text style={dl.logSub}>"{m.note}"</Text> : null}
                        {m.insight ? <Text style={dl.logInsight}>{m.insight}</Text> : null}
                      </View>
                      <Text style={dl.time}>{shortTime(m.logged_at)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedLog.weights.length > 0 && (
                <View style={dl.section}>
                  <Text style={dl.sectionTitle}>⚖️ Weight</Text>
                  {selectedLog.weights.map((w, i) => (
                    <View key={i} style={dl.logRow}>
                      <View style={[dl.logDot, { backgroundColor: colors.success }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={dl.logMain}>{w.weight_kg} kg ({w.weight_lbs} lbs)</Text>
                        {w.guidance && <Text style={dl.logSub}>{w.guidance.message}</Text>}
                      </View>
                      <Text style={dl.time}>{shortTime(w.logged_at)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const dl = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  title:        { fontSize: 18, fontWeight: '800', color: colors.textDeep },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyTxt:     { fontSize: 15, color: colors.textMuted },
  section:      { marginBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textDeep, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  logRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 10 },
  logDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose, marginTop: 6 },
  logMain:      { fontSize: 14, fontWeight: '700', color: colors.textDeep },
  logSub:       { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  logInsight:   { fontSize: 12, color: colors.textBody, marginTop: 4, fontStyle: 'italic' },
  triage:       { fontSize: 12, color: colors.success, marginTop: 4 },
  triageUrgent: { color: colors.error },
  time:         { fontSize: 11, color: colors.textLight },
});

// ─── Body quick-log sheet ─────────────────────────────────────────────────────

function BodySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router   = useRouter();
  const slideY   = useRef(new Animated.Value(400)).current;
  const [water, setWater]   = useState(0);
  const [kicks, setKicks]   = useState(0);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (visible) {
      setWater(0); setKicks(0); setSaved(false);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }).start();
    }
  }, [visible]);

  function close() {
    Animated.timing(slideY, { toValue: 400, duration: 220, useNativeDriver: true }).start(onClose);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <TouchableOpacity style={bs.overlay} activeOpacity={1} onPress={close} />
      <Animated.View style={[bs.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={bs.handle} />
        <View style={bs.header}>
          <Text style={bs.title}>Body log</Text>
          <TouchableOpacity onPress={close} style={bs.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={bs.content}>
          {/* Water counter */}
          <View style={bs.counterCard}>
            <Text style={bs.counterIcon}>💧</Text>
            <View style={{ flex: 1 }}>
              <Text style={bs.counterLabel}>Water glasses</Text>
              <Text style={bs.counterTarget}>Target: 8 glasses/day</Text>
            </View>
            <View style={bs.counterRow}>
              <TouchableOpacity style={bs.counterBtn} onPress={() => setWater((v) => Math.max(0, v - 1))}>
                <Text style={bs.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={bs.counterVal}>{water}</Text>
              <TouchableOpacity style={bs.counterBtn} onPress={() => setWater((v) => v + 1)}>
                <Text style={bs.counterBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Kick counter */}
          <View style={bs.counterCard}>
            <Text style={bs.counterIcon}>👶</Text>
            <View style={{ flex: 1 }}>
              <Text style={bs.counterLabel}>Kick count</Text>
              <Text style={bs.counterTarget}>Goal: 10 kicks/2 hours</Text>
            </View>
            <View style={bs.counterRow}>
              <TouchableOpacity style={bs.counterBtn} onPress={() => setKicks((v) => Math.max(0, v - 1))}>
                <Text style={bs.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={bs.counterVal}>{kicks}</Text>
              <TouchableOpacity style={bs.counterBtn} onPress={() => setKicks((v) => v + 1)}>
                <Text style={bs.counterBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contraction timer link */}
          <TouchableOpacity
            style={bs.timerLink}
            onPress={() => { close(); setTimeout(() => router.push('/features/contraction-timer' as any), 300); }}
          >
            <Ionicons name="timer-outline" size={20} color={colors.lavender} />
            <Text style={bs.timerTxt}>Open Contraction Timer</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const bs = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 34 : 24 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title:       { fontSize: 20, fontWeight: '800', color: colors.textDeep },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  content:     { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  counterCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgWarm, borderRadius: radius.lg, padding: spacing.md, gap: 12 },
  counterIcon: { fontSize: 24 },
  counterLabel:{ fontSize: 15, fontWeight: '700', color: colors.textDeep },
  counterTarget:{ fontSize: 12, color: colors.textMuted, marginTop: 2 },
  counterRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt:{ color: colors.white, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  counterVal:  { fontSize: 22, fontWeight: '900', color: colors.textDeep, minWidth: 30, textAlign: 'center' },
  timerLink:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lavenderPale, borderRadius: radius.lg, padding: spacing.md, gap: 10 },
  timerTxt:    { flex: 1, fontSize: 15, fontWeight: '700', color: colors.lavenderDark },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TrackScreen() {
  const dispatch = useAppDispatch();

  const { today, historyDots, weekSummary, selectedDate, status } =
    useAppSelector((s) => s.tracking);

  const [activeSheet, setSheet] = useState<'symptom' | 'mood' | 'weight' | 'body' | null>(null);
  const [viewingDate, setViewingDate] = useState<string | null>(null);
  const [tab, setTab] = useState<'today' | 'history'>('today');

  useEffect(() => {
    dispatch(fetchTodayLogs());
    dispatch(fetchHistoryDots());
    dispatch(fetchWeightHistory());
    dispatch(fetchWeekSummary());
  }, [dispatch]);

  const onDaySelect = useCallback((date: string) => {
    const today = new Date().toISOString().slice(0, 10);
    if (date === today) {
      // Selecting today just scrolls/highlights — don't open modal
      dispatch(setSelectedDate(date));
      return;
    }
    dispatch(setSelectedDate(date));
    setViewingDate(date);
  }, [dispatch]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.screenTitle}>Tracking</Text>
        <View style={s.tabSwitcher}>
          {(['today', 'history'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'today' ? 'Today' : 'History'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Calendar strip */}
      <CalendarStrip
        dots={historyDots}
        selectedDate={selectedDate}
        onSelect={onDaySelect}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'today' ? (
          <>
            {/* Today's summary */}
            <TodaySummaryCard
              symptoms={today.symptoms}
              moods={today.moods}
              weights={today.weights}
            />

            {/* 4 tiles */}
            <Text style={s.sectionTitle}>What would you like to log?</Text>
            <TileGrid onPress={(id) => setSheet(id)} />

            {/* Weekly AI summary */}
            {weekSummary && (
              <>
                <Text style={s.sectionTitle}>This week</Text>
                <WeekSummaryCard summary={weekSummary} />
              </>
            )}

            {/* Dot legend */}
            <View style={s.legend}>
              {[
                { color: DOT_COLORS.symptom, label: 'Symptoms' },
                { color: DOT_COLORS.mood,    label: 'Mood' },
                { color: DOT_COLORS.weight,  label: 'Weight' },
              ].map((item) => (
                <View key={item.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: item.color }]} />
                  <Text style={s.legendTxt}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          /* ── History tab ── */
          <>
            <Text style={s.sectionTitle}>Tap any day to view its full log</Text>
            <View style={s.historyHint}>
              <Text style={s.historyHintTxt}>
                Coloured dots on the calendar above show days with logged data.
                Tap any past day to open its full log, which you can share as a doctor-ready summary.
              </Text>
            </View>
            {/* Recent logs list */}
            {historyDots
              .filter((d) => d.hasSymptom || d.hasMood || d.hasWeight)
              .slice(0, 20)
              .map((d) => (
                <TouchableOpacity
                  key={d.date}
                  style={s.historyRow}
                  onPress={() => setViewingDate(d.date)}
                >
                  <View style={s.historyDateWrap}>
                    <Text style={s.historyDay}>{new Date(d.date).getDate()}</Text>
                    <Text style={s.historyMonth}>
                      {new Date(d.date).toLocaleString('default', { month: 'short' })}
                    </Text>
                  </View>
                  <View style={s.historyDots}>
                    {d.hasSymptom && <View style={[s.historyDot, { backgroundColor: DOT_COLORS.symptom }]}><Text style={s.historyDotTxt}>💊</Text></View>}
                    {d.hasMood    && <View style={[s.historyDot, { backgroundColor: DOT_COLORS.mood    }]}><Text style={s.historyDotTxt}>💜</Text></View>}
                    {d.hasWeight  && <View style={[s.historyDot, { backgroundColor: DOT_COLORS.weight  }]}><Text style={s.historyDotTxt}>⚖️</Text></View>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </TouchableOpacity>
              ))}
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Logger bottom sheets */}
      <SymptomLogger visible={activeSheet === 'symptom'} onClose={() => setSheet(null)} />
      <MoodLogger    visible={activeSheet === 'mood'}    onClose={() => setSheet(null)} />
      <WeightLogger  visible={activeSheet === 'weight'}  onClose={() => setSheet(null)} />
      <BodySheet     visible={activeSheet === 'body'}    onClose={() => setSheet(null)} />

      {/* Day log modal */}
      {viewingDate && (
        <DayLogModal
          date={viewingDate}
          onClose={() => {
            setViewingDate(null);
            dispatch(clearSelectedDay());
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { paddingBottom: spacing.xl },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  screenTitle: { fontSize: 22, fontWeight: '900', color: colors.textDeep, letterSpacing: -0.5 },
  tabSwitcher: { flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.pill, padding: 3 },
  tabBtn:      { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill },
  tabBtnActive:{ backgroundColor: colors.surface, ...shadow.sm },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTxtActive:{ color: colors.textDeep, fontWeight: '800' },
  sectionTitle:{ fontSize: 14, fontWeight: '800', color: colors.textDeep, marginHorizontal: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
  legend:      { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.sm },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendTxt:   { fontSize: 12, color: colors.textMuted },
  historyHint: { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md },
  historyHintTxt:{ fontSize: 13, color: colors.textBody, lineHeight: 20 },
  historyRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, ...shadow.sm },
  historyDateWrap: { width: 40, alignItems: 'center' },
  historyDay:  { fontSize: 18, fontWeight: '900', color: colors.textDeep },
  historyMonth:{ fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  historyDots: { flex: 1, flexDirection: 'row', gap: 8 },
  historyDot:  { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  historyDotTxt: { fontSize: 14 },
});
