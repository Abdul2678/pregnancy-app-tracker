// app/features/six-week-checkin.tsx
// 6-week postpartum check-in: wellbeing questions → AI summary for the GP.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import { generateSixWeekSummary } from '../../store/postpartumSlice';
import api from '../../lib/api';

const QUESTIONS: { id: string; question: string; options: string[] }[] = [
  {
    id: 'bleeding',
    question: 'Has your bleeding (lochia) stopped?',
    options: ['Stopped completely', 'Very light / occasional', 'Still bleeding regularly'],
  },
  {
    id: 'pain',
    question: 'How is pain from your birth (stitches, incision, or general)?',
    options: ['No pain', 'Mild, improving', 'Still significant pain'],
  },
  {
    id: 'mood',
    question: 'Over the past 2 weeks, how has your mood been?',
    options: ['Mostly good', 'Up and down', 'Mostly low or anxious'],
  },
  {
    id: 'sleep',
    question: 'When the baby sleeps, can you sleep?',
    options: ['Yes, usually', 'Sometimes', 'Rarely — even when I have the chance'],
  },
  {
    id: 'feeding',
    question: 'How is feeding going?',
    options: ['Going well', 'Some challenges', 'Really struggling'],
  },
  {
    id: 'support',
    question: 'Do you feel you have enough support?',
    options: ['Yes', 'Somewhat', 'No, I feel quite alone'],
  },
  {
    id: 'bond',
    question: 'How connected do you feel to your baby?',
    options: ['Very connected', 'It\'s growing', 'Detached or numb'],
  },
];

export default function SixWeekCheckin() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { sixWeekSummary, sixWeekStatus, profile } = useAppSelector((s) => s.postpartum);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep]       = useState<'questions' | 'summary'>('questions');
  const [transitioning, setTransitioning] = useState(false);

  const allAnswered = QUESTIONS.every((q) => answers[q.id]);
  const concerningAnswers = QUESTIONS.filter((q) => answers[q.id] === q.options[2]).length;

  const onComplete = async () => {
    // Save answers as a journal-style mood log so they feed the AI summary
    try {
      await api.post('/tracking/mood', {
        mood: 'six_week_checkin',
        moodScore: concerningAnswers >= 3 ? 2 : concerningAnswers >= 1 ? 3 : 4,
        notes: QUESTIONS.map((q) => `${q.question} → ${answers[q.id]}`).join('\n'),
      }).catch(() => {});
    } catch {}
    setStep('summary');
    dispatch(generateSixWeekSummary());
  };

  const onShare = () => {
    if (sixWeekSummary) Share.share({ message: sixWeekSummary });
  };

  const onTransition = async () => {
    Alert.alert(
      'Switch to regular tracking?',
      'This ends postpartum mode and returns the app to general health tracking. Your data is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setTransitioning(true);
            try {
              await api.put('/user/profile', {});
              // Postpartum deactivation endpoint not yet available; flag intent locally
              Alert.alert('Coming soon', 'Full transition to regular tracking will be available in the next update. Postpartum mode remains active for now.');
            } finally {
              setTransitioning(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>6-Week Check-In</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {step === 'questions' && (
          <>
            <Text style={s.intro}>
              {profile?.baby_name ? `${profile.baby_name} is` : 'Your baby is'} around 6 weeks old — time for YOUR check-up.
              Answer honestly; this builds a summary you can take to your doctor.
            </Text>

            {QUESTIONS.map((q, qi) => (
              <View key={q.id} style={s.qCard}>
                <Text style={s.qNum}>{qi + 1} of {QUESTIONS.length}</Text>
                <Text style={s.qText}>{q.question}</Text>
                {q.options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.opt, answers[q.id] === opt && s.optActive]}
                    onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    activeOpacity={0.8}
                  >
                    <View style={[s.radio, answers[q.id] === opt && s.radioActive]} />
                    <Text style={[s.optText, answers[q.id] === opt && s.optTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {concerningAnswers >= 2 && allAnswered && (
              <View style={s.supportCard}>
                <Text style={s.supportTitle}>💜 Some of your answers suggest things are hard right now</Text>
                <Text style={s.supportText}>
                  That's exactly what the 6-week check is for. Please share these answers with your doctor —
                  and remember support is available any time through the mood check-in screen.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, !allAnswered && s.submitBtnDisabled]}
              disabled={!allAnswered}
              onPress={onComplete}
              activeOpacity={0.85}
            >
              <Text style={s.submitText}>Generate my GP summary</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'summary' && (
          <>
            {sixWeekStatus === 'generating' && (
              <View style={s.genWrap}>
                <ActivityIndicator color="#CC6E9A" size="large" />
                <Text style={s.genText}>Building your health summary…</Text>
              </View>
            )}

            {sixWeekStatus === 'error' && (
              <View style={s.genWrap}>
                <Text style={s.errText}>Could not generate the summary.</Text>
                <TouchableOpacity style={s.retryBtn} onPress={() => dispatch(generateSixWeekSummary())}>
                  <Text style={s.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}

            {sixWeekSummary && (
              <>
                <View style={s.summaryCard}>
                  <Text style={s.summaryTitle}>🩺 Your GP Appointment Summary</Text>
                  <Text style={s.summaryBody}>{sixWeekSummary}</Text>
                </View>

                <TouchableOpacity style={s.shareBtn} onPress={onShare} activeOpacity={0.85}>
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={s.shareText}>Share / print for appointment</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.transitionBtn} onPress={onTransition} disabled={transitioning} activeOpacity={0.85}>
                  {transitioning
                    ? <ActivityIndicator color="#8E72B8" />
                    : <Text style={s.transitionText}>Transition to regular health tracking →</Text>}
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#FDF0F8' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#3D1440' },
  content:     { padding: 20, paddingTop: 8 },

  intro:       { fontSize: 14, color: '#5A4636', lineHeight: 21, marginBottom: 18 },

  qCard:       { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 14 },
  qNum:        { fontSize: 11, fontWeight: '700', color: '#C8B8A2', marginBottom: 4 },
  qText:       { fontSize: 15, fontWeight: '800', color: '#3D1440', marginBottom: 12, lineHeight: 21 },
  opt:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#FDF0F8' },
  optActive:   { backgroundColor: '#CC6E9A' },
  radio:       { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#DDD5C4' },
  radioActive: { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  optText:     { flex: 1, fontSize: 13, color: '#5A4636', fontWeight: '600' },
  optTextActive: { color: '#FFFFFF' },

  supportCard: { backgroundColor: '#F1EAFA', borderRadius: 16, padding: 16, marginBottom: 14 },
  supportTitle: { fontSize: 14, fontWeight: '800', color: '#3D1440', marginBottom: 6 },
  supportText: { fontSize: 13, color: '#5A4636', lineHeight: 19 },

  submitBtn:   { backgroundColor: '#CC6E9A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.4 },
  submitText:  { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  genWrap:     { alignItems: 'center', paddingTop: 80, gap: 16 },
  genText:     { color: '#8A7359', fontSize: 14 },
  errText:     { color: '#C0524A', fontSize: 14 },
  retryBtn:    { backgroundColor: '#CC6E9A', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryText:   { color: '#FFFFFF', fontWeight: '700' },

  summaryCard: { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 20, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#3D1440', marginBottom: 12 },
  summaryBody: { fontSize: 14, color: '#3D1440', lineHeight: 22 },

  shareBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#CC6E9A', borderRadius: 14, paddingVertical: 15, marginBottom: 10 },
  shareText:   { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  transitionBtn: { alignItems: 'center', paddingVertical: 14 },
  transitionText: { color: '#8E72B8', fontWeight: '700', fontSize: 14 },
});
