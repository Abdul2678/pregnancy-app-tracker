// components/home/MoodCheckIn.tsx
// Compact daily mood check-in card for the home screen.
// Shows 5 emoji buttons; one tap logs the mood and shows a brief AI reflection.
// Links to the full mental health screen via the router.

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  submitMoodCheckin, loadTodayMood,
} from '../../store/mentalHealthSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

const MOOD_FACES = [
  { score: 1, emoji: '😢', label: 'Hard',     color: '#D63B5A' },
  { score: 2, emoji: '😔', label: 'Low',      color: '#E0846A' },
  { score: 3, emoji: '😐', label: 'Okay',     color: '#F4C842' },
  { score: 4, emoji: '🙂', label: 'Good',     color: '#7BC67A' },
  { score: 5, emoji: '😊', label: 'Great',    color: '#4EA86A' },
];

export default function MoodCheckIn() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { todayEntry, todayAnalysis, status } = useAppSelector((s) => s.mentalHealth);

  const hasLogged = !!todayEntry;
  const isSubmitting = status === 'submitting';

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(loadTodayMood());
  }, [dispatch]);

  useEffect(() => {
    if (todayAnalysis) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [todayAnalysis, fadeAnim]);

  const handleTap = useCallback((score: number) => {
    if (hasLogged || isSubmitting) return;
    const face = MOOD_FACES.find((f) => f.score === score)!;
    dispatch(submitMoodCheckin({
      mood: face.label.toLowerCase(),
      moodScore: score,
      emotions: [],
      note: '',
    }));
  }, [hasLogged, isSubmitting, dispatch]);

  const activeScore = todayEntry?.mood_score ?? null;
  const activeFace = MOOD_FACES.find((f) => f.score === activeScore);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>How are you feeling today?</Text>
        <TouchableOpacity onPress={() => router.push('/features/mental-health')}>
          <Text style={styles.seeMore}>See more →</Text>
        </TouchableOpacity>
      </View>

      {hasLogged && activeFace ? (
        <View style={styles.loggedRow}>
          <View style={[styles.loggedFace, { backgroundColor: activeFace.color + '22' }]}>
            <Text style={styles.loggedFaceEmoji}>{activeFace.emoji}</Text>
          </View>
          <View style={styles.loggedText}>
            <Text style={styles.loggedLabel}>
              You're feeling <Text style={{ color: activeFace.color, fontWeight: '700' }}>{activeFace.label.toLowerCase()}</Text> today
            </Text>
            {todayAnalysis?.reflection ? (
              <Animated.Text style={[styles.reflection, { opacity: fadeAnim }]} numberOfLines={2}>
                {todayAnalysis.reflection}
              </Animated.Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.facesRow}>
          {MOOD_FACES.map((f) => (
            <TouchableOpacity
              key={f.score}
              style={styles.faceBtn}
              onPress={() => handleTap(f.score)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Text style={styles.faceEmoji}>{f.emoji}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.sm,
    marginHorizontal: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textDeep },
  seeMore: { fontSize: 12, color: colors.rose, fontWeight: '600' },

  facesRow: { flexDirection: 'row', justifyContent: 'space-around' },
  faceBtn: { padding: spacing.xs, alignItems: 'center', minWidth: 48 },
  faceEmoji: { fontSize: 28 },

  loggedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  loggedFace: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  loggedFaceEmoji: { fontSize: 26 },
  loggedText: { flex: 1 },
  loggedLabel: { fontSize: 13, color: colors.textBody },
  reflection: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
});
