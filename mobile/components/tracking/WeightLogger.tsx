// components/tracking/WeightLogger.tsx
// Weight input with kg/lbs toggle, healthy range, SVG mini chart, AI guidance.

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { logWeight } from '../../store/trackingSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── Weight gain guidelines (normal BMI) ─────────────────────────────────────
// Expected cumulative gain by week (kg) — centre of normal-BMI range

function expectedGainKg(week: number): number {
  if (week <= 12) return 0.5 + (week - 1) * (1.0 / 12);     // ~0.5-1.5 kg in T1
  if (week <= 26) return 1.5 + (week - 13) * (0.45);         // ~0.45 kg/week T2
  return 1.5 + 13 * 0.45 + (week - 27) * 0.45;              // ~0.45 kg/week T3
}

function weeklyRangeLabel(week: number): string {
  if (week <= 13) return '0–2 kg total in first trimester';
  return '0.3–0.5 kg/week during 2nd & 3rd trimester';
}

// ─── SVG mini weight chart ────────────────────────────────────────────────────

interface WeightPoint { weight_kg: number; logged_at: string }

function WeightMiniChart({ weights, current }: { weights: WeightPoint[]; current?: number }) {
  if (weights.length < 2) return null;

  const W = 300, H = 80;
  const PAD = { l: 36, r: 12, t: 12, b: 24 };
  const pts = weights.slice(0, 8).reverse();

  const vals = pts.map((w) => w.weight_kg);
  if (current) vals.push(current);
  const minV = Math.min(...vals) - 0.5;
  const maxV = Math.max(...vals) + 0.5;

  const xOf = (i: number) => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r);
  const yOf = (v: number) => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b);

  const linePoints = pts.map((w, i) => `${xOf(i)},${yOf(w.weight_kg)}`).join(' ');

  return (
    <View style={ch.wrap}>
      <Text style={ch.chartTitle}>Last {pts.length} weigh-ins</Text>
      <Svg width={W} height={H}>
        {/* Y grid lines */}
        {[minV + 0.5, (minV + maxV) / 2, maxV - 0.5].map((v, i) => (
          <Line key={i} x1={PAD.l} y1={yOf(v)} x2={W - PAD.r} y2={yOf(v)}
            stroke={colors.borderLight} strokeWidth={1} />
        ))}
        {/* Line */}
        <Polyline points={linePoints} fill="none" stroke={colors.rose} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((w, i) => (
          <Circle key={i} cx={xOf(i)} cy={yOf(w.weight_kg)} r={3.5}
            fill={colors.surface} stroke={colors.rose} strokeWidth={2} />
        ))}
        {/* Y labels */}
        <SvgText x={PAD.l - 4} y={yOf(minV + 0.5) + 4} fontSize={9} textAnchor="end" fill={colors.textLight}>
          {(minV + 0.5).toFixed(1)}
        </SvgText>
        <SvgText x={PAD.l - 4} y={yOf(maxV - 0.5) + 4} fontSize={9} textAnchor="end" fill={colors.textLight}>
          {(maxV - 0.5).toFixed(1)}
        </SvgText>
        {/* X labels: first and last */}
        <SvgText x={xOf(0)} y={H - 6} fontSize={9} textAnchor="middle" fill={colors.textLight}>
          {shortDate(pts[0].logged_at)}
        </SvgText>
        <SvgText x={xOf(pts.length - 1)} y={H - 6} fontSize={9} textAnchor="middle" fill={colors.textLight}>
          {shortDate(pts[pts.length - 1].logged_at)}
        </SvgText>
      </Svg>
    </View>
  );
}

function shortDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

const ch = StyleSheet.create({
  wrap:       { marginBottom: spacing.md },
  chartTitle: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 4 },
});

// ─── Guidance card ────────────────────────────────────────────────────────────

function GuidanceCard({ guidance }: { guidance: { status: string; message: string } }) {
  const isAlert = guidance.status === 'above_range' || guidance.status === 'below_range';
  return (
    <View style={[gc.card, isAlert && gc.cardAlert]}>
      <Text style={[gc.status, isAlert && gc.statusAlert]}>
        {statusLabel(guidance.status)}
      </Text>
      <Text style={gc.msg}>{guidance.message}</Text>
    </View>
  );
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    on_track:     '✅ On track',
    above_range:  '⚠️ Above expected range',
    below_range:  '⚠️ Below expected range',
    normal:       '✅ Healthy gain',
  };
  return map[s] ?? `✅ ${s}`;
}

const gc = StyleSheet.create({
  card:       { backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.success },
  cardAlert:  { backgroundColor: '#FFF8E1', borderColor: '#F59E0B' },
  status:     { fontSize: 14, fontWeight: '800', color: colors.success, marginBottom: 4 },
  statusAlert:{ color: '#B45309' },
  msg:        { fontSize: 13, color: colors.textBody, lineHeight: 20 },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { visible: boolean; onClose: () => void }

export function WeightLogger({ visible, onClose }: Props) {
  const dispatch   = useAppDispatch();
  const submitting = useAppSelector((s) => s.tracking.status === 'submitting');
  const weightHistory = useAppSelector((s) => s.tracking.weightHistory);
  const currentWeek   = useAppSelector((s) => s.profile.profile?.currentWeek ?? 12);

  const slideY = useRef(new Animated.Value(600)).current;
  const [value, setValue]       = useState('');
  const [unit, setUnit]         = useState<'kg' | 'lbs'>('kg');
  const [guidance, setGuidance] = useState<{ status: string; message: string } | null>(null);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (visible) {
      setValue('');
      setGuidance(null);
      setDone(false);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }).start();
    }
  }, [visible]);

  function close() {
    Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose);
  }

  const numericValue = parseFloat(value.replace(',', '.'));
  const kgValue      = unit === 'kg' ? numericValue : numericValue / 2.205;
  const lbsValue     = unit === 'lbs' ? numericValue : numericValue * 2.205;

  async function submit() {
    if (isNaN(kgValue) || kgValue <= 0) return;
    const res = await dispatch(logWeight({
      weight_kg:  Math.round(kgValue * 10) / 10,
      weight_lbs: Math.round(lbsValue * 10) / 10,
    })).unwrap();
    setGuidance(res.guidance ?? null);
    setDone(true);
  }

  // Healthy range card
  const expected = expectedGainKg(currentWeek);
  const rangeLabel = weeklyRangeLabel(currentWeek);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Log Weight</Text>
            <TouchableOpacity onPress={close} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={s.content}>
            {done && guidance ? (
              /* ── Post-submit ── */
              <>
                <View style={s.doneRow}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                  <Text style={s.doneTxt}>
                    {unit === 'kg'
                      ? `${kgValue.toFixed(1)} kg logged`
                      : `${lbsValue.toFixed(1)} lbs logged`}
                  </Text>
                </View>
                <GuidanceCard guidance={guidance} />
                {weightHistory.length >= 2 && (
                  <View style={{ marginTop: spacing.md }}>
                    <WeightMiniChart weights={weightHistory} />
                  </View>
                )}
                <TouchableOpacity style={s.doneBtn} onPress={close}>
                  <Text style={s.doneBtnTxt}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Input form ── */
              <>
                {/* Unit toggle + input */}
                <View style={s.inputRow}>
                  <TextInput
                    style={s.numberInput}
                    placeholder={unit === 'kg' ? '0.0 kg' : '0.0 lbs'}
                    placeholderTextColor={colors.textLight}
                    value={value}
                    onChangeText={setValue}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <View style={s.unitRow}>
                    {(['kg', 'lbs'] as const).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[s.unitBtn, unit === u && s.unitBtnActive]}
                        onPress={() => {
                          setUnit(u);
                          if (!isNaN(numericValue)) {
                            const converted = u === 'lbs' ? numericValue * 2.205 : numericValue / 2.205;
                            setValue(converted.toFixed(1));
                          }
                        }}
                      >
                        <Text style={[s.unitTxt, unit === u && s.unitTxtActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Healthy range info */}
                <View style={s.rangeCard}>
                  <View style={s.rangeRow}>
                    <Text style={s.rangeIcon}>📊</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rangeLabel}>Expected gain by week {currentWeek}</Text>
                      <Text style={s.rangeVal}>~{expected.toFixed(1)} kg total</Text>
                    </View>
                  </View>
                  <Text style={s.rangeHint}>{rangeLabel}</Text>
                </View>

                {/* Mini chart (history) */}
                {weightHistory.length >= 2 && (
                  <WeightMiniChart
                    weights={weightHistory}
                    current={!isNaN(kgValue) ? kgValue : undefined}
                  />
                )}

                {/* Convert display */}
                {!isNaN(numericValue) && numericValue > 0 && (
                  <Text style={s.convertHint}>
                    ≈ {unit === 'kg' ? `${lbsValue.toFixed(1)} lbs` : `${kgValue.toFixed(1)} kg`}
                  </Text>
                )}

                <TouchableOpacity
                  style={[s.submitBtn, (isNaN(kgValue) || kgValue <= 0) && s.submitBtnDisabled]}
                  onPress={submit}
                  disabled={isNaN(kgValue) || kgValue <= 0 || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={s.submitTxt}>Save weight</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  kav:             { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:           { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 34 : 24 },
  handle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  title:           { fontSize: 20, fontWeight: '800', color: colors.textDeep },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  content:         { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  inputRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  numberInput:     { flex: 1, fontSize: 36, fontWeight: '800', color: colors.textDeep, borderBottomWidth: 2, borderBottomColor: colors.rose, paddingBottom: 6 },
  unitRow:         { flexDirection: 'row', backgroundColor: colors.bgWarm, borderRadius: radius.pill, padding: 3 },
  unitBtn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  unitBtnActive:   { backgroundColor: colors.surface, ...shadow.sm },
  unitTxt:         { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  unitTxtActive:   { color: colors.textDeep, fontWeight: '800' },
  rangeCard:       { backgroundColor: colors.lavenderPale, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  rangeRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rangeIcon:       { fontSize: 18 },
  rangeLabel:      { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  rangeVal:        { fontSize: 15, fontWeight: '800', color: colors.lavenderDark },
  rangeHint:       { fontSize: 12, color: colors.textBody },
  convertHint:     { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  submitBtn:       { backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitTxt:       { color: colors.white, fontWeight: '700', fontSize: 15 },
  doneRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  doneTxt:         { fontSize: 16, fontWeight: '700', color: colors.success },
  doneBtn:         { backgroundColor: colors.bgWarm, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  doneBtnTxt:      { color: colors.textDeep, fontWeight: '700', fontSize: 15 },
});
