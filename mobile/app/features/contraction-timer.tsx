// app/features/contraction-timer.tsx
// What-to-Expect-class contraction timer: live durations, 5-1-1 rule, AI analysis.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Linking, Platform, Share, SafeAreaView, Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── Keep-awake ───────────────────────────────────────────────────────────────

function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cleanup: (() => void) | null = null;
    try {
      const ka = require('expo-keep-awake');
      ka.activateKeepAwakeAsync?.('contraction-timer');
      cleanup = () => ka.deactivateKeepAwakeAsync?.('contraction-timer');
    } catch (_) {}
    return () => cleanup?.();
  }, [enabled]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contraction {
  id:         string;
  startMs:    number;
  endMs:      number | null;  // null = still in progress
  durationSec: number | null;
  intervalSec: number | null; // gap since PREVIOUS contraction ended
}

interface AIAnalysis {
  pattern:        string;
  assessment:     string;
  recommendation: string;
  urgencyLevel:   'high' | 'medium' | 'low';
  goToHospital:   boolean;
  meets511:       boolean;
}

// ─── 5-1-1 Rule checker ───────────────────────────────────────────────────────

interface Rule511Status {
  frequency: boolean; // avg interval ≤ 5 min (300 s)
  duration:  boolean; // avg duration ≥ 60 s
  time:      boolean; // session running ≥ 60 min
  met:       boolean; // all three green
}

function check511(contractions: Contraction[], sessionStartMs: number): Rule511Status {
  const finished = contractions.filter((c) => c.durationSec !== null);
  const recent   = finished.slice(-3);

  const avgDuration = recent.length > 0
    ? recent.reduce((acc, c) => acc + (c.durationSec ?? 0), 0) / recent.length
    : 0;

  const intervals = recent.filter((c) => c.intervalSec !== null);
  const avgInterval = intervals.length > 0
    ? intervals.reduce((acc, c) => acc + (c.intervalSec ?? 0), 0) / intervals.length
    : Infinity;

  const sessionMins = (Date.now() - sessionStartMs) / 60000;

  const frequency = avgInterval <= 300;
  const duration  = avgDuration >= 60;
  const time      = sessionMins >= 60;

  return { frequency, duration, time, met: frequency && duration && time };
}

// ─── Live stat card ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  highlight,
  pulse,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  pulse?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View style={[sc.card, highlight && sc.cardHL, { transform: [{ scale }] }]}>
      <Text style={sc.label}>{label}</Text>
      <Text style={[sc.value, highlight && sc.valueHL]}>{value}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  card:    { flex: 1, ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', minWidth: 90 },
  cardHL:  { backgroundColor: colors.roseLight, borderWidth: 1.5, borderColor: colors.rose },
  label:   { fontSize: 10, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, textAlign: 'center' },
  value:   { fontSize: 22, fontWeight: '900', color: colors.textDeep, fontVariant: ['tabular-nums'], textAlign: 'center' },
  valueHL: { color: colors.rose },
  sub:     { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
});

// ─── 5-1-1 rule indicator ─────────────────────────────────────────────────────

function RuleIndicator({ status, contractions }: { status: Rule511Status; contractions: Contraction[] }) {
  const met = status.met;

  const indicators = [
    { key: 'frequency', label: '≤5 min apart', met: status.frequency },
    { key: 'duration',  label: '≥1 min long',  met: status.duration  },
    { key: 'time',      label: '≥1 hour',       met: status.time      },
  ];

  return (
    <View style={ri.wrap}>
      <View style={ri.header}>
        <Text style={ri.title}>5-1-1 Rule</Text>
        <View style={[ri.badge, met && ri.badgeMet]}>
          <Text style={[ri.badgeTxt, met && ri.badgeTxtMet]}>
            {met ? '✓ MET — Consider going in' : 'Not yet met'}
          </Text>
        </View>
      </View>
      <View style={ri.dotsRow}>
        {indicators.map((ind) => (
          <View key={ind.key} style={ri.dotItem}>
            <View style={[ri.dot, ind.met && ri.dotMet]}>
              {ind.met && <Ionicons name="checkmark" size={12} color={colors.white} />}
            </View>
            <Text style={[ri.dotLabel, ind.met && ri.dotLabelMet]}>{ind.label}</Text>
          </View>
        ))}
      </View>
      {met && (
        <Text style={ri.advice}>
          Your contractions are following the 5-1-1 pattern. This is a good time to head to your birth centre.
        </Text>
      )}
    </View>
  );
}

const ri = StyleSheet.create({
  wrap:        { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:       { fontSize: 15, fontWeight: '800', color: colors.textDeep },
  badge:       { backgroundColor: colors.borderLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeMet:    { backgroundColor: colors.successLight },
  badgeTxt:    { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  badgeTxtMet: { color: colors.success },
  dotsRow:     { flexDirection: 'row', gap: spacing.md },
  dotItem:     { alignItems: 'center', flex: 1 },
  dot:         { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dotMet:      { backgroundColor: colors.success },
  dotLabel:    { fontSize: 11, color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
  dotLabelMet: { color: colors.success },
  advice:      { marginTop: 10, fontSize: 13, color: colors.success, lineHeight: 19, fontStyle: 'italic' },
});

// ─── Contraction list row ─────────────────────────────────────────────────────

function ContractionRow({
  index,
  contraction,
  isActive,
}: {
  index: number;
  contraction: Contraction;
  isActive: boolean;
}) {
  const dur  = contraction.durationSec !== null ? fmtSec(contraction.durationSec) : '…';
  const intv = contraction.intervalSec !== null ? fmtSec(contraction.intervalSec) : '—';
  const time = new Date(contraction.startMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const isLong = (contraction.durationSec ?? 0) >= 60;
  const isShortInterval = contraction.intervalSec !== null && contraction.intervalSec <= 300;

  return (
    <View style={cl.row}>
      <View style={[cl.num, isActive && cl.numActive]}>
        <Text style={[cl.numTxt, isActive && cl.numTxtActive]}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={cl.dataRow}>
          <Text style={cl.time}>{time}</Text>
          <View style={[cl.durPill, isLong && cl.durPillGood]}>
            <Text style={[cl.durTxt, isLong && cl.durTxtGood]}>{dur}</Text>
          </View>
          {contraction.intervalSec !== null && (
            <View style={[cl.intPill, isShortInterval && cl.intPillGood]}>
              <Text style={[cl.intTxt, isShortInterval && cl.intTxtGood]}>↔ {intv}</Text>
            </View>
          )}
        </View>
      </View>
      {isActive && <ActivityIndicator size="small" color={colors.rose} />}
    </View>
  );
}

const cl = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 10 },
  num:        { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  numActive:  { backgroundColor: colors.rose },
  numTxt:     { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  numTxtActive:{ color: colors.white },
  dataRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  time:       { fontSize: 14, fontWeight: '700', color: colors.textDeep },
  durPill:    { backgroundColor: colors.bgWarm, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  durPillGood:{ backgroundColor: colors.successLight },
  durTxt:     { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  durTxtGood: { color: colors.success },
  intPill:    { backgroundColor: colors.bgWarm, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  intPillGood:{ backgroundColor: '#DBEAFE' },
  intTxt:     { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  intTxtGood: { color: '#1D4ED8' },
});

// ─── AI result card ───────────────────────────────────────────────────────────

function AIResultCard({ analysis }: { analysis: AIAnalysis }) {
  const goNow = analysis.goToHospital;

  function openMaps() {
    const q = encodeURIComponent('maternity hospital near me');
    const url = Platform.select({
      ios:     `maps:0,0?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://maps.google.com/?q=${q}`,
    });
    Linking.openURL(url!).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${q}`)
    );
  }

  return (
    <View style={[ai.card, goNow && ai.cardUrgent]}>
      {/* Decision banner */}
      <View style={[ai.banner, goNow ? ai.bannerGo : ai.bannerStay]}>
        <Text style={ai.bannerEmoji}>{goNow ? '🏥' : '🏠'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[ai.decision, goNow ? ai.decisionGo : ai.decisionStay]}>
            GO TO HOSPITAL: {goNow ? 'YES' : 'NO'}
          </Text>
          <Text style={ai.decisionSub}>
            {goNow ? 'Head to your birth centre now' : 'Stay home and continue monitoring'}
          </Text>
        </View>
      </View>

      {/* Urgency */}
      <View style={ai.urgencyRow}>
        <Text style={ai.urgencyLabel}>Urgency:</Text>
        <View style={[ai.urgencyBadge,
          analysis.urgencyLevel === 'high'   && ai.urgencyHigh,
          analysis.urgencyLevel === 'medium' && ai.urgencyMed,
          analysis.urgencyLevel === 'low'    && ai.urgencyLow,
        ]}>
          <Text style={[ai.urgencyTxt,
            analysis.urgencyLevel === 'high'   && { color: colors.error },
            analysis.urgencyLevel === 'medium' && { color: '#B45309' },
            analysis.urgencyLevel === 'low'    && { color: colors.success },
          ]}>
            {analysis.urgencyLevel.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Assessment */}
      {analysis.pattern ? (
        <Text style={ai.pattern}>{analysis.pattern}</Text>
      ) : null}
      <Text style={ai.assessment}>{analysis.assessment}</Text>
      {analysis.recommendation ? (
        <Text style={ai.rec}>{analysis.recommendation}</Text>
      ) : null}

      {/* Hospital button */}
      {goNow && (
        <TouchableOpacity style={ai.hospitalBtn} onPress={openMaps}>
          <Ionicons name="navigate" size={18} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={ai.hospitalBtnTxt}>Navigate to nearest maternity hospital</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const ai = StyleSheet.create({
  card:         { ...shadow.md, backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md },
  cardUrgent:   { borderWidth: 2, borderColor: colors.error },
  banner:       { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 12 },
  bannerGo:     { backgroundColor: colors.errorLight },
  bannerStay:   { backgroundColor: colors.successLight },
  bannerEmoji:  { fontSize: 32 },
  decision:     { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  decisionGo:   { color: colors.error },
  decisionStay: { color: colors.success },
  decisionSub:  { fontSize: 13, color: colors.textBody, marginTop: 2 },
  urgencyRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 8, gap: 8 },
  urgencyLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  urgencyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  urgencyHigh:  { backgroundColor: colors.errorLight },
  urgencyMed:   { backgroundColor: '#FEF3C7' },
  urgencyLow:   { backgroundColor: colors.successLight },
  urgencyTxt:   { fontSize: 12, fontWeight: '800' },
  pattern:      { paddingHorizontal: spacing.md, fontSize: 15, fontWeight: '700', color: colors.textDeep, marginBottom: 4 },
  assessment:   { paddingHorizontal: spacing.md, fontSize: 14, color: colors.textBody, lineHeight: 21, marginBottom: 6 },
  rec:          { paddingHorizontal: spacing.md, paddingBottom: spacing.md, fontSize: 13, color: colors.textBody, lineHeight: 19, fontStyle: 'italic' },
  hospitalBtn:  { margin: spacing.md, marginTop: 0, backgroundColor: colors.error, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  hospitalBtnTxt:{ color: colors.white, fontWeight: '800', fontSize: 14 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ContractionTimerScreen() {
  // ── Session state ──────────────────────────────────────────────────────────
  const [sessionActive,     setSessionActive]    = useState(false);
  const [sessionStartMs,    setSessionStartMs]   = useState<number | null>(null);
  const [contractions,      setContractions]     = useState<Contraction[]>([]);
  const [isInContraction,   setIsInContraction]  = useState(false);
  const [contractionStartMs,setContractionStart] = useState<number | null>(null);
  const [tick,              setTick]             = useState(0);  // forces re-renders for live display
  const [analyzing,         setAnalyzing]        = useState(false);
  const [analysis,          setAnalysis]         = useState<AIAnalysis | null>(null);
  const [saving,            setSaving]           = useState(false);
  const [lastEndMs,         setLastEndMs]        = useState<number | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useKeepAwake(sessionActive);

  // ── Live tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionActive) {
      tickRef.current = setInterval(() => setTick((n) => n + 1), 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [sessionActive]);

  // ── Derived live values ────────────────────────────────────────────────────
  const now = Date.now();

  const currentDurationMs = isInContraction && contractionStartMs
    ? now - contractionStartMs
    : 0;

  const timeSinceLastMs = !isInContraction && lastEndMs
    ? now - lastEndMs
    : 0;

  const sessionMs = sessionStartMs ? now - sessionStartMs : 0;

  // ── Stats derived from past contractions ───────────────────────────────────
  const finished = contractions.filter((c) => c.durationSec !== null);
  const recent3  = finished.slice(-3);

  const avgDuration = recent3.length > 0
    ? Math.round(recent3.reduce((a, c) => a + (c.durationSec ?? 0), 0) / recent3.length)
    : null;

  const recentIntervals = recent3.filter((c) => c.intervalSec !== null);
  const avgInterval = recentIntervals.length > 0
    ? Math.round(recentIntervals.reduce((a, c) => a + (c.intervalSec ?? 0), 0) / recentIntervals.length)
    : null;

  const rule511 = sessionStartMs
    ? check511(contractions, sessionStartMs)
    : { frequency: false, duration: false, time: false, met: false };

  // ── Main toggle ────────────────────────────────────────────────────────────
  const toggleContraction = useCallback(() => {
    const time = Date.now();

    if (!sessionActive) {
      // Start entire session
      setSessionActive(true);
      setSessionStartMs(time);
      setIsInContraction(true);
      setContractionStart(time);
      setAnalysis(null);
      return;
    }

    if (!isInContraction) {
      // Start new contraction
      setIsInContraction(true);
      setContractionStart(time);
    } else {
      // End contraction
      const start       = contractionStartMs ?? time;
      const durSec      = Math.round((time - start) / 1000);
      const intervalSec = lastEndMs !== null
        ? Math.round((start - lastEndMs) / 1000)
        : null;

      const newContraction: Contraction = {
        id:          String(time),
        startMs:     start,
        endMs:       time,
        durationSec: durSec,
        intervalSec,
      };

      setContractions((prev) => [...prev, newContraction]);
      setLastEndMs(time);
      setIsInContraction(false);
      setContractionStart(null);
    }
  }, [sessionActive, isInContraction, contractionStartMs, lastEndMs]);

  // ── AI Analysis ────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (contractions.length < 2) return;
    setAnalyzing(true);
    try {
      const payload = {
        contractions: contractions.map((c) => ({
          startTime:   new Date(c.startMs).toISOString(),
          durationSec: c.durationSec ?? 0,
          intervalSec: c.intervalSec ?? undefined,
        })),
        sessionDurationMin: Math.round(sessionMs / 60000),
        currentWeek: undefined, // could be injected from profile
      };
      const { data } = await api.post('/tracking/contractions', payload);
      const result = data?.data ?? data;
      setAnalysis({
        pattern:        result.pattern ?? result.analysis?.pattern ?? '',
        assessment:     result.assessment ?? result.analysis?.assessment ?? '',
        recommendation: result.recommendation ?? result.analysis?.recommendation ?? '',
        urgencyLevel:   result.urgencyLevel ?? result.analysis?.urgencyLevel ?? 'low',
        goToHospital:   result.goToHospitalNow ?? result.goToHospital ?? false,
        meets511:       rule511.met,
      });
    } catch (_) {
      setAnalysis({
        pattern:        '',
        assessment:     'Unable to complete analysis. Please contact your midwife directly if concerned.',
        recommendation: '',
        urgencyLevel:   'low',
        goToHospital:   false,
        meets511:       rule511.met,
      });
    }
    setAnalyzing(false);
  }, [contractions, sessionMs, rule511.met]);

  // ── Save & Share ───────────────────────────────────────────────────────────
  async function saveSession() {
    setSaving(true);
    try {
      await api.post('/tracking/contractions/save', {
        sessionStart: sessionStartMs ? new Date(sessionStartMs).toISOString() : null,
        contractions: contractions.map((c) => ({
          startTime:   new Date(c.startMs).toISOString(),
          durationSec: c.durationSec,
          intervalSec: c.intervalSec,
        })),
        rule511Met:    rule511.met,
        aiAnalysis:    analysis,
      });
    } catch (_) {}
    setSaving(false);
    setSessionActive(false);
  }

  async function shareSession() {
    const lines = [
      `🤰 Contraction Session`,
      sessionStartMs ? `Started: ${new Date(sessionStartMs).toLocaleTimeString()}` : '',
      `Duration: ${fmtMs(sessionMs)}`,
      `Contractions: ${contractions.length}`,
      avgDuration !== null ? `Avg duration: ${fmtSec(avgDuration)}` : '',
      avgInterval !== null ? `Avg interval: ${fmtSec(avgInterval)}` : '',
      `5-1-1 rule: ${rule511.met ? 'MET ✓' : 'not yet met'}`,
      '',
      'Contractions:',
      ...contractions.map((c, i) =>
        `  ${i + 1}. ${new Date(c.startMs).toLocaleTimeString()} · ${fmtSec(c.durationSec ?? 0)} long${c.intervalSec !== null ? ` · interval ${fmtSec(c.intervalSec)}` : ''}`
      ),
      '',
      analysis ? `AI Assessment: ${analysis.assessment}` : '',
      analysis ? `Go to hospital: ${analysis.goToHospital ? 'YES' : 'NO'}` : '',
      '',
      'Recorded with Bloom 🌸',
    ].filter(Boolean);

    await Share.share({ message: lines.join('\n'), title: 'Contraction Session — Bloom' });
  }

  function resetSession() {
    setSessionActive(false);
    setSessionStartMs(null);
    setContractions([]);
    setIsInContraction(false);
    setContractionStart(null);
    setLastEndMs(null);
    setAnalysis(null);
    setTick(0);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const btnLabel = !sessionActive
    ? 'Start timing'
    : isInContraction
    ? 'Contraction ended'
    : 'Contraction started';

  const btnSubLabel = !sessionActive
    ? 'Tap when a contraction begins'
    : isInContraction
    ? 'Tap when it stops'
    : 'Tap when the next one starts';

  const btnColor = isInContraction ? colors.error : colors.rose;

  // In-contraction pulsing animation ref
  const pulseBg = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isInContraction) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseBg, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(pulseBg, { toValue: 0, duration: 600, useNativeDriver: false }),
        ])
      );
      anim.start();
      return () => { anim.stop(); pulseBg.setValue(0); };
    }
  }, [isInContraction]);

  const btnBg = pulseBg.interpolate({
    inputRange: [0, 1],
    outputRange: [isInContraction ? '#FDEDF0' : colors.roseLight,
                  isInContraction ? '#FFC5CF' : colors.roseLight],
  });

  // In-progress contraction that hasn't ended yet (for display in list)
  const activeContraction: Contraction | null = isInContraction && contractionStartMs ? {
    id:          'active',
    startMs:     contractionStartMs,
    endMs:       null,
    durationSec: Math.round(currentDurationMs / 1000),
    intervalSec: lastEndMs !== null ? Math.round((contractionStartMs - lastEndMs) / 1000) : null,
  } : null;

  const displayList = activeContraction
    ? [...contractions, activeContraction]
    : contractions;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Session timer ────────────────────────────────────────── */}
        {sessionActive && (
          <View style={s.sessionBar}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={s.sessionTime}>{fmtMs(sessionMs)}</Text>
            <Text style={s.sessionLabel}>session</Text>
          </View>
        )}

        {/* ── Main toggle button ───────────────────────────────────── */}
        <Animated.View style={[s.mainBtnWrap, { backgroundColor: btnBg }]}>
          <TouchableOpacity style={s.mainBtn} onPress={toggleContraction} activeOpacity={0.85}>
            <View style={[s.mainBtnInner, { borderColor: btnColor }]}>
              <Ionicons
                name={isInContraction ? 'stop-circle' : 'radio-button-on'}
                size={48}
                color={btnColor}
              />
              <Text style={[s.mainBtnLabel, { color: btnColor }]}>{btnLabel}</Text>
              <Text style={s.mainBtnSub}>{btnSubLabel}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Live stats row ───────────────────────────────────────── */}
        {sessionActive && (
          <View style={s.statsRow}>
            <StatCard
              label="Duration"
              value={fmtMs(currentDurationMs)}
              sub={isInContraction ? 'live' : 'last contraction'}
              highlight={isInContraction}
              pulse={isInContraction}
            />
            <StatCard
              label="Since last"
              value={isInContraction ? '—' : fmtMs(timeSinceLastMs)}
              sub="interval"
            />
            <StatCard
              label="Avg every"
              value={avgInterval !== null ? fmtSec(avgInterval) : '—'}
              sub="last 3"
            />
            <StatCard
              label="Avg length"
              value={avgDuration !== null ? fmtSec(avgDuration) : '—'}
              sub="last 3"
            />
          </View>
        )}

        {/* ── 5-1-1 indicator ─────────────────────────────────────── */}
        {contractions.length >= 2 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <RuleIndicator status={rule511} contractions={contractions} />
          </View>
        )}

        {/* ── AI analysis ─────────────────────────────────────────── */}
        {contractions.length >= 2 && (
          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
            {analysis ? (
              <AIResultCard analysis={analysis} />
            ) : (
              <TouchableOpacity
                style={[s.analyzeBtn, analyzing && { opacity: 0.6 }]}
                onPress={runAnalysis}
                disabled={analyzing}
              >
                {analyzing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="analytics-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={s.analyzeBtnTxt}>Analyse with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Contraction list ─────────────────────────────────────── */}
        {displayList.length > 0 && (
          <View style={s.listWrap}>
            <Text style={s.listTitle}>This session ({displayList.length} contraction{displayList.length !== 1 ? 's' : ''})</Text>
            {[...displayList].reverse().map((c, i) => (
              <ContractionRow
                key={c.id}
                index={displayList.length - i}
                contraction={c}
                isActive={c.id === 'active'}
              />
            ))}
          </View>
        )}

        {/* ── No data state ────────────────────────────────────────── */}
        {!sessionActive && contractions.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>⏱️</Text>
            <Text style={s.emptyTitle}>Ready to time contractions</Text>
            <Text style={s.emptyBody}>
              Tap the button above when a contraction starts, then again when it ends.
              We'll track frequency, duration, and tell you when to head in.
            </Text>
            <View style={s.ruleCard}>
              <Text style={s.ruleTitle}>The 5-1-1 rule</Text>
              <Text style={s.ruleBody}>Most hospitals recommend going in when contractions are:</Text>
              <Text style={s.ruleBullet}>• <Text style={s.ruleEm}>5</Text> minutes apart</Text>
              <Text style={s.ruleBullet}>• <Text style={s.ruleEm}>1</Text> minute long</Text>
              <Text style={s.ruleBullet}>• For at least <Text style={s.ruleEm}>1</Text> hour</Text>
            </View>
          </View>
        )}

        {/* ── Session actions ──────────────────────────────────────── */}
        {sessionActive && contractions.length > 0 && (
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionSecondary} onPress={shareSession}>
              <Ionicons name="share-outline" size={18} color={colors.textBody} />
              <Text style={s.actionSecTxt}>Share for doctor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionSave, saving && { opacity: 0.6 }]}
              onPress={saveSession}
              disabled={saving}
            >
              <Text style={s.actionSaveTxt}>{saving ? 'Saving…' : 'Save & end'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reset (after session ends) */}
        {!sessionActive && contractions.length > 0 && (
          <TouchableOpacity style={s.resetBtn} onPress={resetSession}>
            <Text style={s.resetTxt}>Start new session</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSec(totalSec: number): string {
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${totalSec}s`;
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: colors.bg },
  scroll:       { paddingBottom: 40 },

  // Session bar
  sessionBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: colors.lavenderPale },
  sessionTime:  { fontSize: 16, fontWeight: '900', color: colors.lavenderDark, fontVariant: ['tabular-nums'] },
  sessionLabel: { fontSize: 12, color: colors.textMuted },

  // Main button
  mainBtnWrap:  { marginHorizontal: spacing.md, marginVertical: spacing.md, borderRadius: radius.xl, overflow: 'hidden' },
  mainBtn:      { padding: spacing.lg },
  mainBtnInner: { borderWidth: 2.5, borderRadius: radius.xl, paddingVertical: spacing.xl, alignItems: 'center', borderStyle: 'dashed' },
  mainBtnLabel: { fontSize: 26, fontWeight: '900', marginTop: spacing.sm, letterSpacing: -0.5 },
  mainBtnSub:   { fontSize: 14, color: colors.textMuted, marginTop: 4 },

  // Stats
  statsRow:     { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 6, marginBottom: spacing.md },

  // Analyze
  analyzeBtn:   { backgroundColor: colors.lavender, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  analyzeBtnTxt:{ color: colors.white, fontWeight: '800', fontSize: 15 },

  // Contraction list
  listWrap:     { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  listTitle:    { fontSize: 13, fontWeight: '800', color: colors.textDeep, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Actions
  actionsRow:   { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  actionSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgWarm, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionSecTxt: { fontSize: 14, color: colors.textBody, fontWeight: '600' },
  actionSave:   { flex: 1, backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.sm, alignItems: 'center' },
  actionSaveTxt:{ color: colors.white, fontWeight: '800', fontSize: 14 },

  resetBtn:     { marginHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.rose, padding: spacing.md, alignItems: 'center' },
  resetTxt:     { color: colors.rose, fontWeight: '700', fontSize: 15 },

  // Empty state
  emptyState:   { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  emptyEmoji:   { fontSize: 40, marginBottom: 12, textAlign: 'center' },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: colors.textDeep, textAlign: 'center', marginBottom: 8 },
  emptyBody:    { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: spacing.lg },
  ruleCard:     { backgroundColor: colors.lavenderPale, borderRadius: radius.lg, padding: spacing.md },
  ruleTitle:    { fontSize: 15, fontWeight: '800', color: colors.lavenderDark, marginBottom: 6 },
  ruleBody:     { fontSize: 13, color: colors.textBody, marginBottom: 6 },
  ruleBullet:   { fontSize: 14, color: colors.textBody, lineHeight: 22 },
  ruleEm:       { fontWeight: '900', color: colors.lavenderDark, fontSize: 16 },
});
