// app/features/kick-counter.tsx
// Kick Counter — WHO 10-kicks-in-2-hours goal, celebration, session history chart.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, SafeAreaView, Share, Platform,
} from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store';
import api from '../../lib/api';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── Keep-awake (gracefully degrades if expo-keep-awake not installed) ─────────

function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cleanup: (() => void) | null = null;
    try {
      // Install with: npx expo install expo-keep-awake
      const ka = require('expo-keep-awake');
      ka.activateKeepAwakeAsync?.('kick-counter');
      cleanup = () => ka.deactivateKeepAwakeAsync?.('kick-counter');
    } catch (_) {}
    return () => cleanup?.();
  }, [enabled]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface KickEvent { timestamp: number; id: string }

interface KickSession {
  id?: string;
  date: string;
  kicks: number;
  goalReached: boolean;
  durationMin: number;
}

// ─── Progress ring ────────────────────────────────────────────────────────────

const RING_SIZE    = 220;
const RING_STROKE  = 14;
const RING_R       = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

function KickRing({ kicks, goalReached }: { kicks: number; goalReached: boolean }) {
  const progress = Math.min(kicks / 10, 1);
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const cx = RING_SIZE / 2, cy = RING_SIZE / 2;
  const ringColor = goalReached ? colors.success : kicks >= 7 ? '#F59E0B' : colors.rose;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
      {/* Track */}
      <Circle cx={cx} cy={cy} r={RING_R} fill="none"
        stroke={colors.borderLight} strokeWidth={RING_STROKE} />
      {/* Progress */}
      {kicks > 0 && (
        <Circle cx={cx} cy={cy} r={RING_R} fill="none"
          stroke={ringColor} strokeWidth={RING_STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
      )}
    </Svg>
  );
}

// ─── Celebration particles ────────────────────────────────────────────────────

const PARTICLE_COUNT = 14;
const PARTICLE_COLORS = [
  colors.rose, colors.lavender, '#F59E0B', colors.success,
  colors.roseMid, colors.lavenderMid, '#EC4899', '#06B6D4',
];

function CelebrationBurst({ active }: { active: boolean }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  new Animated.Value(0),
      y:  new Animated.Value(0),
      op: new Animated.Value(0),
      sc: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!active) return;
    // Reset all particles
    particles.forEach((p) => { p.x.setValue(0); p.y.setValue(0); p.op.setValue(0); p.sc.setValue(0); });

    Animated.stagger(
      40,
      particles.map((p, i) => {
        const angle  = (i / PARTICLE_COUNT) * 2 * Math.PI;
        const dist   = 90 + (i % 3) * 30;
        return Animated.sequence([
          Animated.parallel([
            Animated.timing(p.op, { toValue: 1, duration: 80,  useNativeDriver: true }),
            Animated.timing(p.sc, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(p.x,  { toValue: Math.cos(angle) * dist, duration: 700, useNativeDriver: true }),
            Animated.timing(p.y,  { toValue: Math.sin(angle) * dist - 20, duration: 700, useNativeDriver: true }),
          ]),
          Animated.timing(p.op, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]);
      })
    ).start();
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
            opacity: p.op,
            transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.sc }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Session history bar chart ────────────────────────────────────────────────

function HistoryChart({ sessions }: { sessions: KickSession[] }) {
  if (sessions.length === 0) return null;

  const W = 300, H = 90, BAR_H = 60;
  const barW = Math.min(36, (W - (sessions.length - 1) * 4) / sessions.length);
  const gap  = sessions.length > 1 ? (W - sessions.length * barW) / (sessions.length - 1) : 0;

  return (
    <View style={hc.wrap}>
      <Text style={hc.title}>Last {sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
      <Svg width={W} height={H}>
        {sessions.map((s, i) => {
          const x      = i * (barW + gap);
          const barPct = Math.min(s.kicks / 10, 1);
          const barFill = barPct * BAR_H;
          const y      = H - 24 - barFill;
          const clr    = s.goalReached ? colors.success : s.kicks >= 7 ? '#F59E0B' : colors.rose;
          return (
            <React.Fragment key={i}>
              {/* Track */}
              <Rect x={x} y={H - 24 - BAR_H} width={barW} height={BAR_H}
                fill={colors.borderLight} rx={4} />
              {/* Fill */}
              <Rect x={x} y={y} width={barW} height={barFill}
                fill={clr} rx={4} />
              {/* Count label */}
              <SvgText x={x + barW / 2} y={y - 4} fontSize={10} textAnchor="middle"
                fill={colors.textMuted} fontWeight="700">
                {s.kicks}
              </SvgText>
              {/* Date label */}
              <SvgText x={x + barW / 2} y={H - 4} fontSize={9} textAnchor="middle"
                fill={colors.textLight}>
                {shortDate(s.date)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={hc.legend}>
        <View style={hc.legendItem}><View style={[hc.dot, { backgroundColor: colors.success }]} /><Text style={hc.legendTxt}>Goal reached</Text></View>
        <View style={hc.legendItem}><View style={[hc.dot, { backgroundColor: colors.rose }]} /><Text style={hc.legendTxt}>In progress</Text></View>
      </View>
    </View>
  );
}

const hc = StyleSheet.create({
  wrap:       { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  title:      { fontSize: 13, fontWeight: '700', color: colors.textDeep, marginBottom: spacing.sm },
  legend:     { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: 11, color: colors.textMuted },
});

// ─── Kick timestamp list item ─────────────────────────────────────────────────

function KickRow({ index, timestamp }: { index: number; timestamp: number }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }).start();
  }, []);

  const elapsed = timestamp; // ms since session start
  const mm = Math.floor(elapsed / 60000);
  const ss = Math.floor((elapsed % 60000) / 1000);

  return (
    <Animated.View style={[kr.row, { transform: [{ scale }] }]}>
      <View style={kr.indexWrap}>
        <Text style={kr.index}>{index}</Text>
      </View>
      <Text style={kr.time}>{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</Text>
      <Text style={kr.label}>kick</Text>
    </Animated.View>
  );
}

const kr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: 10 },
  indexWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.roseLight, alignItems: 'center', justifyContent: 'center' },
  index:     { fontSize: 13, fontWeight: '800', color: colors.rose },
  time:      { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textDeep, fontVariant: ['tabular-nums'] },
  label:     { fontSize: 12, color: colors.textMuted },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

const GOAL   = 10;
const LIMIT  = 2 * 60 * 60 * 1000; // 2 hours in ms

export default function KickCounterScreen() {
  const currentWeek   = useAppSelector((s) => s.profile.profile?.currentWeek ?? 24);

  const [sessionActive,    setSessionActive]    = useState(false);
  const [sessionStart,     setSessionStart]     = useState<number | null>(null);
  const [kicks,            setKicks]            = useState<KickEvent[]>([]);
  const [elapsed,          setElapsed]          = useState(0); // ms
  const [goalReached,      setGoalReached]      = useState(false);
  const [showCelebration,  setShowCelebration]  = useState(false);
  const [overLimitWarned,  setOverLimitWarned]  = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [history,          setHistory]          = useState<KickSession[]>([]);
  const [historyLoaded,    setHistoryLoaded]    = useState(false);
  const [activeTab,        setActiveTab]        = useState<'session' | 'history'>('session');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseScale  = useRef(new Animated.Value(1)).current;

  useKeepAwake(sessionActive);

  // Fetch history on mount
  useEffect(() => {
    api.get('/kicks/history?limit=7')
      .then(({ data }) => {
        const payload = data?.data ?? data;
        setHistory(payload?.sessions ?? []);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

  // Session elapsed timer
  useEffect(() => {
    if (sessionActive && sessionStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - sessionStart);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sessionActive, sessionStart]);

  // 2-hour limit warning
  useEffect(() => {
    if (sessionActive && elapsed >= LIMIT && kicks.length < GOAL && !overLimitWarned) {
      setOverLimitWarned(true);
    }
  }, [elapsed, sessionActive, kicks.length, overLimitWarned]);

  // Button pulse animation loop while active
  useEffect(() => {
    if (!sessionActive || goalReached) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [sessionActive, goalReached]);

  function startSession() {
    const now = Date.now();
    setSessionActive(true);
    setSessionStart(now);
    setKicks([]);
    setElapsed(0);
    setGoalReached(false);
    setShowCelebration(false);
    setOverLimitWarned(false);
  }

  const recordKick = useCallback(() => {
    if (!sessionActive || !sessionStart) return;

    // Ripple feedback
    Animated.sequence([
      Animated.timing(pulseScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(pulseScale, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    setKicks((prev) => {
      const newKicks = [...prev, { timestamp: Date.now() - sessionStart, id: String(Date.now()) }];
      if (newKicks.length >= GOAL && !goalReached) {
        setGoalReached(true);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2200);
      }
      return newKicks;
    });
  }, [sessionActive, sessionStart, goalReached]);

  async function saveSession() {
    if (!sessionStart) return;
    setSaving(true);
    try {
      await api.post('/kicks/session', {
        startTime:    new Date(sessionStart).toISOString(),
        endTime:      new Date().toISOString(),
        kickCount:    kicks.length,
        goalReached,
        durationMin:  Math.round(elapsed / 60000),
        kicks:        kicks.map((k) => ({ timestamp: new Date(sessionStart + k.timestamp).toISOString() })),
      });
      // Refresh history
      const { data } = await api.get('/kicks/history?limit=7');
      const payload = data?.data ?? data;
      setHistory(payload?.sessions ?? []);
    } catch (_) {}
    setSaving(false);
    setSessionActive(false);
    setActiveTab('history');
  }

  async function shareSession() {
    if (!sessionStart) return;
    const lines = [
      `👶 Kick Counter Session`,
      `Date: ${new Date(sessionStart).toLocaleDateString()}`,
      `Kicks: ${kicks.length} / ${GOAL}`,
      goalReached ? '✅ Goal reached in time' : elapsed >= LIMIT ? '⚠️ Goal not reached in 2 hours' : '🔄 Session ongoing',
      `Duration: ${formatElapsed(elapsed)}`,
      ``,
      `Timestamps:`,
      ...kicks.map((k, i) => `  ${i + 1}. +${formatElapsed(k.timestamp)}`),
      ``,
      `Recorded with Bloom 🌸`,
    ];
    await Share.share({ message: lines.join('\n'), title: 'Kick Counter Session' });
  }

  // ── Pre-week-24 gate ────────────────────────────────────────────────────────
  if (currentWeek < 24) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.gateWrap}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>👶</Text>
          <Text style={s.gateTitle}>Kick counting starts at week 24</Text>
          <Text style={s.gateBody}>
            Babies don't have predictable movement patterns until around 24 weeks.
            Come back in {24 - currentWeek} week{24 - currentWeek !== 1 ? 's' : ''}!
          </Text>
          <View style={s.gateWeekBadge}>
            <Text style={s.gateWeekTxt}>You're at week {currentWeek}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const elapsedH = Math.floor(elapsed / 3600000);
  const elapsedM = Math.floor((elapsed % 3600000) / 60000);
  const elapsedS = Math.floor((elapsed % 60000) / 1000);
  const progressPct = (kicks.length / GOAL) * 100;

  return (
    <SafeAreaView style={s.safe}>
      {/* Tab switcher */}
      <View style={s.tabRow}>
        {(['session', 'history'] as const).map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, activeTab === t && s.tabBtnActive]} onPress={() => setActiveTab(t)}>
            <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>
              {t === 'session' ? 'Session' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'history' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          <HistoryChart sessions={history} />
          {history.length === 0 && historyLoaded && (
            <View style={s.emptyHistory}>
              <Text style={{ fontSize: 36 }}>📭</Text>
              <Text style={s.emptyHistoryTxt}>No sessions yet.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Not started ── */}
          {!sessionActive ? (
            <View style={s.startWrap}>
              <Text style={s.startTitle}>Count your baby's kicks</Text>
              <Text style={s.startSub}>WHO recommends 10 kicks in 2 hours</Text>
              <TouchableOpacity style={s.startBtn} onPress={startSession}>
                <Text style={s.startBtnTxt}>Start session</Text>
              </TouchableOpacity>
              {history.length > 0 && (
                <TouchableOpacity onPress={() => setActiveTab('history')} style={{ marginTop: 16 }}>
                  <Text style={s.historyLink}>View past sessions →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* ── Session timer ── */}
              <View style={s.timerRow}>
                <Text style={s.timerLabel}>Elapsed</Text>
                <Text style={s.timerValue}>
                  {String(elapsedH).padStart(2, '0')}:{String(elapsedM).padStart(2, '0')}:{String(elapsedS).padStart(2, '0')}
                </Text>
                <View style={[s.limitBar, elapsed >= LIMIT && s.limitBarRed]}>
                  <Text style={[s.limitTxt, elapsed >= LIMIT && s.limitTxtRed]}>
                    {elapsed >= LIMIT ? '⚠️ 2h limit reached' : `${Math.max(0, 120 - elapsedM)} min left`}
                  </Text>
                </View>
              </View>

              {/* ── Central tap button ── */}
              <View style={s.ringWrap}>
                <KickRing kicks={kicks.length} goalReached={goalReached} />
                <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                  <TouchableOpacity
                    style={[s.tapBtn, goalReached && s.tapBtnDone]}
                    onPress={recordKick}
                    disabled={goalReached}
                    activeOpacity={0.85}
                  >
                    <Text style={s.kickCount}>{kicks.length}</Text>
                    <Text style={s.tapLabel}>{goalReached ? '🎉' : 'tap to count'}</Text>
                    <Text style={s.goalLabel}>/ {GOAL}</Text>
                  </TouchableOpacity>
                </Animated.View>
                <CelebrationBurst active={showCelebration} />
              </View>

              {/* ── Goal state ── */}
              {goalReached ? (
                <View style={s.goalCard}>
                  <Text style={s.goalEmoji}>🎉</Text>
                  <Text style={s.goalTitle}>Baby is active!</Text>
                  <Text style={s.goalSub}>
                    {kicks.length} kicks in {Math.ceil(elapsed / 60000)} minutes — great movement!
                  </Text>
                </View>
              ) : overLimitWarned ? (
                <View style={s.warnCard}>
                  <Text style={s.warnEmoji}>⚠️</Text>
                  <Text style={s.warnTitle}>Consider calling your doctor</Text>
                  <Text style={s.warnSub}>
                    You've been counting for 2 hours and baby has moved {kicks.length} time{kicks.length !== 1 ? 's' : ''}.
                    If you're concerned, contact your midwife or doctor.
                  </Text>
                </View>
              ) : null}

              {/* ── Progress bar ── */}
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  <Animated.View style={[s.progressFill, {
                    width: `${progressPct}%` as any,
                    backgroundColor: goalReached ? colors.success : kicks.length >= 7 ? '#F59E0B' : colors.rose,
                  }]} />
                </View>
                <Text style={s.progressTxt}>{kicks.length} / {GOAL} kicks</Text>
              </View>

              {/* ── Timestamp list ── */}
              {kicks.length > 0 && (
                <View style={s.kickList}>
                  <Text style={s.kickListTitle}>Kicks this session</Text>
                  {[...kicks].reverse().map((k, i) => (
                    <KickRow key={k.id} index={kicks.length - i} timestamp={k.timestamp} />
                  ))}
                </View>
              )}

              {/* ── Actions ── */}
              <View style={s.actionRow}>
                <TouchableOpacity style={s.actionBtn} onPress={shareSession}>
                  <Ionicons name="share-outline" size={18} color={colors.textBody} />
                  <Text style={s.actionBtnTxt}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saveSession}
                  disabled={saving}
                >
                  <Text style={s.saveBtnTxt}>{saving ? 'Saving…' : 'Save & end session'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return iso.slice(5, 10); }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bg },
  scroll:     { paddingBottom: spacing.xxl, alignItems: 'center' },

  // Pre-week gate
  gateWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  gateTitle:   { fontSize: 22, fontWeight: '800', color: colors.textDeep, textAlign: 'center', marginBottom: 12 },
  gateBody:    { fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  gateWeekBadge: { backgroundColor: colors.lavenderLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill },
  gateWeekTxt: { fontSize: 15, fontWeight: '700', color: colors.lavenderDark },

  // Tab
  tabRow:      { flexDirection: 'row', marginHorizontal: spacing.md, marginVertical: spacing.sm, backgroundColor: colors.borderLight, borderRadius: radius.pill, padding: 3 },
  tabBtn:      { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.pill },
  tabBtnActive:{ backgroundColor: colors.surface, ...shadow.sm },
  tabTxt:      { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTxtActive:{ color: colors.textDeep, fontWeight: '800' },

  // Start screen
  startWrap:   { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl },
  startTitle:  { fontSize: 24, fontWeight: '900', color: colors.textDeep, marginBottom: 8, textAlign: 'center' },
  startSub:    { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'center' },
  startBtn:    { backgroundColor: colors.rose, borderRadius: radius.pill, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
  startBtnTxt: { color: colors.white, fontWeight: '800', fontSize: 18 },
  historyLink: { color: colors.rose, fontWeight: '700', fontSize: 14 },

  // Timer
  timerRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  timerLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  timerValue: { fontSize: 28, fontWeight: '900', color: colors.textDeep, fontVariant: ['tabular-nums'] },
  limitBar:   { backgroundColor: colors.bgWarm, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  limitBarRed:{ backgroundColor: colors.errorLight },
  limitTxt:   { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  limitTxtRed:{ color: colors.error },

  // Ring + button
  ringWrap:   { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
  tapBtn:     { width: RING_SIZE - 40, height: RING_SIZE - 40, borderRadius: (RING_SIZE - 40) / 2, backgroundColor: colors.roseLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.rose },
  tapBtnDone: { backgroundColor: colors.successLight, borderColor: colors.success },
  kickCount:  { fontSize: 64, fontWeight: '900', color: colors.textDeep, lineHeight: 70, letterSpacing: -2 },
  tapLabel:   { fontSize: 14, color: colors.textMuted, fontWeight: '600', marginTop: -4 },
  goalLabel:  { fontSize: 14, color: colors.textLight, fontWeight: '600' },

  // Goal / warning cards
  goalCard:   { ...shadow.sm, backgroundColor: colors.successLight, borderRadius: radius.xl, padding: spacing.lg, marginHorizontal: spacing.md, alignItems: 'center', marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.success },
  goalEmoji:  { fontSize: 36, marginBottom: 8 },
  goalTitle:  { fontSize: 20, fontWeight: '900', color: '#065F46', marginBottom: 4 },
  goalSub:    { fontSize: 14, color: colors.success, textAlign: 'center' },
  warnCard:   { ...shadow.sm, backgroundColor: '#FFF8E1', borderRadius: radius.xl, padding: spacing.lg, marginHorizontal: spacing.md, alignItems: 'center', marginBottom: spacing.md, borderWidth: 1.5, borderColor: '#F59E0B' },
  warnEmoji:  { fontSize: 36, marginBottom: 8 },
  warnTitle:  { fontSize: 17, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  warnSub:    { fontSize: 13, color: '#92400E', textAlign: 'center', lineHeight: 20 },

  // Progress bar
  progressWrap:  { width: '100%', paddingHorizontal: spacing.md, marginBottom: spacing.md },
  progressTrack: { height: 10, backgroundColor: colors.borderLight, borderRadius: 5, overflow: 'hidden', marginBottom: 5 },
  progressFill:  { height: 10, borderRadius: 5 },
  progressTxt:   { fontSize: 12, color: colors.textMuted, textAlign: 'right', fontWeight: '600' },

  // Kick list
  kickList:      { width: '100%', paddingHorizontal: spacing.md, marginBottom: spacing.md },
  kickListTitle: { fontSize: 13, fontWeight: '800', color: colors.textDeep, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Actions
  actionRow:  { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, width: '100%' },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgWarm, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionBtnTxt: { fontSize: 14, color: colors.textBody, fontWeight: '600' },
  saveBtn:    { flex: 1, backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center' },
  saveBtnTxt: { color: colors.white, fontWeight: '800', fontSize: 15 },

  // History
  emptyHistory:  { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyHistoryTxt: { fontSize: 15, color: colors.textMuted },
});
