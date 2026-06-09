// components/tracking/MoodLogger.tsx
// 5-mood emoji selector, optional note, AI mental health insight, PPD awareness card.

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { logMood } from '../../store/trackingSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ─── Mood definitions ─────────────────────────────────────────────────────────

const MOODS = [
  { score: 1, emoji: '😭', label: 'Very sad',    color: '#EF4444', bg: '#FEE2E2' },
  { score: 2, emoji: '😢', label: 'Low',         color: '#F97316', bg: '#FFEDD5' },
  { score: 3, emoji: '😐', label: 'Okay',        color: '#EAB308', bg: '#FEF9C3' },
  { score: 4, emoji: '🙂', label: 'Good',        color: colors.success, bg: colors.successLight },
  { score: 5, emoji: '😄', label: 'Great',       color: '#059669', bg: '#D1FAE5' },
] as const;

// ─── PPD awareness card ───────────────────────────────────────────────────────

function PPDCard() {
  return (
    <View style={ppd.card}>
      <View style={ppd.headerRow}>
        <Text style={ppd.icon}>💜</Text>
        <Text style={ppd.title}>We noticed you've been feeling low</Text>
      </View>
      <Text style={ppd.body}>
        It's completely normal to have difficult days during pregnancy and postpartum.
        If you've been feeling persistently sad, anxious, or overwhelmed for more than
        two weeks, talking to your midwife or doctor can help.
      </Text>
      <View style={ppd.resources}>
        <Text style={ppd.resourcesLabel}>You're not alone — support is available:</Text>
        <Text style={ppd.resource}>• Postpartum Support International: 1-800-944-4773</Text>
        <Text style={ppd.resource}>• PANDAS Foundation: 0808 1961 776 (UK)</Text>
        <Text style={ppd.resource}>• Or speak to your GP / midwife</Text>
      </View>
    </View>
  );
}

const ppd = StyleSheet.create({
  card:         { backgroundColor: colors.lavenderPale, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: colors.lavenderMid, marginTop: spacing.md },
  headerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  icon:         { fontSize: 22 },
  title:        { flex: 1, fontSize: 15, fontWeight: '800', color: colors.lavenderDark },
  body:         { fontSize: 13, color: colors.textBody, lineHeight: 20, marginBottom: 10 },
  resources:    { backgroundColor: colors.lavenderLight, borderRadius: radius.sm, padding: spacing.sm },
  resourcesLabel: { fontSize: 12, fontWeight: '700', color: colors.lavenderDark, marginBottom: 4 },
  resource:     { fontSize: 12, color: colors.textBody, lineHeight: 19 },
});

// ─── AI insight card ──────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: string }) {
  return (
    <View style={ic.card}>
      <Text style={ic.label}>✨ Bloom's insight</Text>
      <Text style={ic.text}>{insight}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  card:  { backgroundColor: colors.surfacePurple, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.lavenderLight },
  label: { fontSize: 12, fontWeight: '800', color: colors.lavender, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  text:  { fontSize: 14, color: colors.textBody, lineHeight: 21 },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { visible: boolean; onClose: () => void }

export function MoodLogger({ visible, onClose }: Props) {
  const dispatch   = useAppDispatch();
  const submitting = useAppSelector((s) => s.tracking.status === 'submitting');
  const consecutiveLow = useAppSelector((s) => s.tracking.consecutiveLowMoods);

  const slideY = useRef(new Animated.Value(600)).current;
  const [selectedScore, setScore] = useState<number | null>(null);
  const [note, setNote]           = useState('');
  const [insight, setInsight]     = useState<string | null>(null);
  const [done, setDone]           = useState(false);
  const [showPPD, setShowPPD]     = useState(false);

  useEffect(() => {
    if (visible) {
      setScore(null);
      setNote('');
      setInsight(null);
      setDone(false);
      setShowPPD(false);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }).start();
    }
  }, [visible]);

  function close() {
    Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose);
  }

  async function submit() {
    if (!selectedScore) return;
    const mood = MOODS.find((m) => m.score === selectedScore)!;
    const res = await dispatch(logMood({
      mood:      mood.label,
      moodScore: selectedScore,
      note,
    })).unwrap();
    setInsight(res.insight ?? null);
    setDone(true);
    // Show PPD card if 3+ consecutive low days (score ≤ 2)
    if ((res.consecutiveLowDays ?? 0) >= 3 || (selectedScore <= 2 && consecutiveLow >= 2)) {
      setShowPPD(true);
    }
  }

  const selectedMood = MOODS.find((m) => m.score === selectedScore);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>How are you feeling?</Text>
            <TouchableOpacity onPress={close} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {done ? (
            /* ── Post-submit result ── */
            <View style={s.resultWrap}>
              <View style={s.doneRow}>
                <Text style={{ fontSize: 36 }}>{selectedMood?.emoji}</Text>
                <View style={{ marginLeft: 12 }}>
                  <Text style={s.doneTxt}>Mood logged</Text>
                  <Text style={s.doneSubTxt}>{selectedMood?.label}</Text>
                </View>
              </View>
              {insight  ? <InsightCard insight={insight} /> : null}
              {showPPD  ? <PPDCard /> : null}
              <TouchableOpacity style={s.doneBtn} onPress={close}>
                <Text style={s.doneBtnTxt}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.formWrap}>
              {/* Big mood emoji row */}
              <View style={s.moodRow}>
                {MOODS.map((m) => {
                  const isActive = selectedScore === m.score;
                  return (
                    <TouchableOpacity
                      key={m.score}
                      style={[s.moodBtn, isActive && { backgroundColor: m.bg, borderColor: m.color }]}
                      onPress={() => setScore(m.score)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.moodEmoji, isActive && s.moodEmojiActive]}>
                        {m.emoji}
                      </Text>
                      <Text style={[s.moodLabel, isActive && { color: m.color, fontWeight: '700' }]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Mood bar visual */}
              {selectedScore && (
                <View style={s.moodBarWrap}>
                  <View style={s.moodBarTrack}>
                    <Animated.View
                      style={[
                        s.moodBarFill,
                        {
                          width: `${((selectedScore - 1) / 4) * 100}%` as any,
                          backgroundColor: selectedMood?.color ?? colors.rose,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[s.moodBarLabel, { color: selectedMood?.color }]}>
                    Feeling {selectedMood?.label?.toLowerCase()}
                  </Text>
                </View>
              )}

              {/* Note */}
              <TextInput
                style={s.noteInput}
                placeholder="What's on your mind? (optional)"
                placeholderTextColor={colors.textLight}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Submit */}
              <TouchableOpacity
                style={[s.submitBtn, !selectedScore && s.submitBtnDisabled]}
                onPress={submit}
                disabled={!selectedScore || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.submitTxt}>Save mood</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title:           { fontSize: 20, fontWeight: '800', color: colors.textDeep },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  formWrap:        { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  moodRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  moodBtn:         { flex: 1, alignItems: 'center', paddingVertical: 10, marginHorizontal: 3, borderRadius: radius.md, backgroundColor: colors.bgWarm, borderWidth: 2, borderColor: 'transparent' },
  moodEmoji:       { fontSize: 28 },
  moodEmojiActive: { fontSize: 34 },
  moodLabel:       { fontSize: 10, fontWeight: '500', color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  moodBarWrap:     { marginBottom: spacing.md },
  moodBarTrack:    { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  moodBarFill:     { height: 6, borderRadius: 3 },
  moodBarLabel:    { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  noteInput:       { backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.textDeep, minHeight: 80, marginBottom: spacing.md },
  submitBtn:       { backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  submitTxt:       { color: colors.white, fontWeight: '700', fontSize: 15 },
  resultWrap:      { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  doneRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  doneTxt:         { fontSize: 18, fontWeight: '800', color: colors.textDeep },
  doneSubTxt:      { fontSize: 14, color: colors.textMuted },
  doneBtn:         { backgroundColor: colors.bgWarm, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  doneBtnTxt:      { color: colors.textDeep, fontWeight: '700', fontSize: 15 },
});
