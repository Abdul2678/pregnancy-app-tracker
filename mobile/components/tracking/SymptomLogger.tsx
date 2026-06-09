// components/tracking/SymptomLogger.tsx
// Categorised symptom grid, per-symptom severity, note, AI triage result.

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Animated, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { logSymptom, type TriageResult } from '../../store/trackingSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── Symptom catalogue ────────────────────────────────────────────────────────

const SYMPTOM_CATEGORIES = [
  {
    label: 'Physical',
    color: colors.roseLight,
    textColor: colors.roseDark,
    icon: '🩺',
    symptoms: [
      'Nausea', 'Vomiting', 'Headache', 'Fatigue', 'Back pain',
      'Swelling', 'Heartburn', 'Cramping', 'Spotting', 'Contractions',
      'Dizziness', 'Shortness of breath', 'Pelvic pressure',
    ],
  },
  {
    label: 'Emotional',
    color: colors.lavenderLight,
    textColor: colors.lavenderDark,
    icon: '💜',
    symptoms: [
      'Anxious', 'Mood swings', 'Happy', 'Overwhelmed',
      'Tearful', 'Irritable', 'Hopeful', 'Stressed',
    ],
  },
  {
    label: 'Other',
    color: '#E8F5ED',
    textColor: '#2E7D32',
    icon: '✨',
    symptoms: [
      'Insomnia', 'Food cravings', 'Food aversions',
      'Breast tenderness', 'Frequent urination', 'Constipation',
    ],
  },
] as const;

// Symptoms that trigger URGENT-level triage warning on select
const HIGH_ALERT_SYMPTOMS = ['Spotting', 'Contractions', 'Cramping'];

// ─── Triage result card ───────────────────────────────────────────────────────

function TriageCard({ triage }: { triage: TriageResult }) {
  const isUrgent = triage.severity === 'EMERGENCY' || triage.severity === 'URGENT';
  const isCallDoctor = triage.severity === 'CALL_DOCTOR';

  const bg = isUrgent
    ? colors.errorLight
    : isCallDoctor
    ? '#FFF8E1'
    : colors.successLight;

  const borderColor = isUrgent
    ? colors.error
    : isCallDoctor
    ? '#F59E0B'
    : colors.success;

  const icon = isUrgent ? '🚨' : isCallDoctor ? '📞' : '✅';
  const label = isUrgent
    ? triage.severity === 'EMERGENCY' ? 'Emergency' : 'Urgent attention needed'
    : isCallDoctor
    ? 'Call your doctor'
    : 'All looks okay';

  return (
    <View style={[tr.card, { backgroundColor: bg, borderColor }]}>
      {isUrgent && (
        <View style={tr.urgentBanner}>
          <Text style={tr.urgentBannerTxt}>⚠️ Please seek medical attention now</Text>
        </View>
      )}
      <View style={tr.row}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[tr.label, { color: isUrgent ? colors.error : isCallDoctor ? '#B45309' : colors.success }]}>
            {label}
          </Text>
          <Text style={tr.rec}>{triage.recommendation}</Text>
        </View>
      </View>
      {triage.response ? (
        <Text style={tr.detail}>{triage.response}</Text>
      ) : null}
    </View>
  );
}

const tr = StyleSheet.create({
  card:          { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, overflow: 'hidden' },
  urgentBanner:  { backgroundColor: colors.error, margin: -spacing.md, marginBottom: spacing.md, padding: spacing.sm, alignItems: 'center' },
  urgentBannerTxt: { color: colors.white, fontWeight: '800', fontSize: 14 },
  row:           { flexDirection: 'row', alignItems: 'flex-start' },
  label:         { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  rec:           { fontSize: 13, color: colors.textBody, lineHeight: 20 },
  detail:        { fontSize: 13, color: colors.textBody, marginTop: 8, lineHeight: 20 },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { visible: boolean; onClose: () => void }

export function SymptomLogger({ visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const submitting = useAppSelector((s) => s.tracking.status === 'submitting');

  const slideY = useRef(new Animated.Value(700)).current;
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [severity, setSeverity]     = useState(2);  // 1-5
  const [note, setNote]             = useState('');
  const [triageResult, setTriage]   = useState<TriageResult | null>(null);
  const [done, setDone]             = useState(false);
  const [alertSymptom, setAlert]    = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      setSeverity(2);
      setNote('');
      setTriage(null);
      setDone(false);
      setAlert(null);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }).start();
    }
  }, [visible]);

  function close() {
    Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true }).start(onClose);
  }

  function toggleSymptom(s: string) {
    if (HIGH_ALERT_SYMPTOMS.includes(s) && !selected.has(s)) {
      setAlert(s);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    const res = await dispatch(logSymptom({
      symptoms: Array.from(selected),
      severity,
      note,
    })).unwrap();
    setTriage(res.triage);
    setDone(true);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Log Symptoms</Text>
            <TouchableOpacity onPress={close} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            {/* Alert for high-risk symptoms */}
            {alertSymptom && (
              <View style={s.alertBanner}>
                <Text style={s.alertTxt}>
                  ⚠️ You selected "{alertSymptom}" — please describe your symptoms below and we'll assess urgency.
                </Text>
                <TouchableOpacity onPress={() => setAlert(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            {done && triageResult ? (
              /* ── Post-submit: triage result ── */
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
                <View style={s.doneRow}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                  <Text style={s.doneTxt}>
                    {selected.size} symptom{selected.size !== 1 ? 's' : ''} logged
                  </Text>
                </View>
                <TriageCard triage={triageResult} />
                <TouchableOpacity style={s.doneBtn} onPress={close}>
                  <Text style={s.doneBtnTxt}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Logger form ── */
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                {/* Symptom grid by category */}
                {SYMPTOM_CATEGORIES.map((cat) => (
                  <View key={cat.label} style={s.catSection}>
                    <Text style={s.catLabel}>{cat.icon} {cat.label}</Text>
                    <View style={s.chipGrid}>
                      {cat.symptoms.map((sym) => {
                        const isOn = selected.has(sym);
                        return (
                          <TouchableOpacity
                            key={sym}
                            style={[
                              s.chip,
                              { backgroundColor: isOn ? cat.textColor : cat.color },
                            ]}
                            onPress={() => toggleSymptom(sym)}
                            activeOpacity={0.8}
                          >
                            <Text style={[s.chipTxt, { color: isOn ? colors.white : cat.textColor }]}>
                              {sym}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* Severity */}
                {selected.size > 0 && (
                  <View style={s.severitySection}>
                    <Text style={s.severityLabel}>
                      Severity — <Text style={{ color: colors.rose }}>{SEVERITY_LABELS[severity - 1]}</Text>
                    </Text>
                    <View style={s.severityRow}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[s.sevBtn, severity === v && s.sevBtnActive]}
                          onPress={() => setSeverity(v)}
                        >
                          <Text style={[s.sevNum, severity === v && s.sevNumActive]}>{v}</Text>
                          <Text style={s.sevEmoji}>{SEV_EMOJIS[v - 1]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Note */}
                <TextInput
                  style={s.noteInput}
                  placeholder="Add a note (optional) — describe timing, what makes it better or worse…"
                  placeholderTextColor={colors.textLight}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Submit */}
                <TouchableOpacity
                  style={[s.submitBtn, selected.size === 0 && s.submitBtnDisabled]}
                  onPress={submit}
                  disabled={selected.size === 0 || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={s.submitTxt}>
                      Log {selected.size > 0 ? `${selected.size} symptom${selected.size !== 1 ? 's' : ''}` : 'symptoms'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const SEVERITY_LABELS = ['Very mild', 'Mild', 'Moderate', 'Severe', 'Very severe'];
const SEV_EMOJIS      = ['😌', '🙂', '😐', '😣', '😫'];

const s = StyleSheet.create({
  overlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  kav:            { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:          { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Platform.OS === 'ios' ? 34 : 24, maxHeight: '92%' },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title:          { fontSize: 20, fontWeight: '800', color: colors.textDeep },
  closeBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  alertBanner:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.errorLight, borderRadius: radius.md, padding: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, gap: 8 },
  alertTxt:       { flex: 1, fontSize: 12, color: colors.error, lineHeight: 18 },
  catSection:     { marginBottom: spacing.md },
  catLabel:       { fontSize: 13, fontWeight: '800', color: colors.textDeep, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  chipTxt:        { fontSize: 13, fontWeight: '600' },
  severitySection:{ marginBottom: spacing.md },
  severityLabel:  { fontSize: 14, fontWeight: '700', color: colors.textDeep, marginBottom: 10 },
  severityRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  sevBtn:         { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.bgWarm, marginHorizontal: 3 },
  sevBtnActive:   { backgroundColor: colors.rose },
  sevNum:         { fontSize: 16, fontWeight: '800', color: colors.textMuted },
  sevNumActive:   { color: colors.white },
  sevEmoji:       { fontSize: 14, marginTop: 2 },
  noteInput:      { backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.textDeep, minHeight: 80, marginBottom: spacing.md },
  submitBtn:      { backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitTxt:      { color: colors.white, fontWeight: '700', fontSize: 15 },
  doneRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  doneTxt:        { fontSize: 16, fontWeight: '700', color: colors.success },
  doneBtn:        { backgroundColor: colors.bgWarm, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  doneBtnTxt:     { color: colors.textDeep, fontWeight: '700', fontSize: 15 },
});
