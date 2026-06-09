// app/features/mental-health.tsx
// Your Wellbeing — mood check-in, 30-day chart, journal, feelings chips, resources.

import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Animated, Linking, SafeAreaView, Platform, useWindowDimensions,
  ActivityIndicator, Alert,
} from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SVGText, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  loadMoodHistory, loadMoodStreak, loadTodayMood, submitMoodCheckin,
  MoodDataPoint,
} from '../../store/mentalHealthSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const MOOD_FACES: { score: number; emoji: string; label: string; color: string }[] = [
  { score: 1, emoji: '😢', label: 'Very hard',  color: '#D63B5A' },
  { score: 2, emoji: '😔', label: 'Low',        color: '#E0846A' },
  { score: 3, emoji: '😐', label: 'Okay',       color: '#F4C842' },
  { score: 4, emoji: '🙂', label: 'Good',       color: '#7BC67A' },
  { score: 5, emoji: '😊', label: 'Great',      color: '#4EA86A' },
];

const SCORE_COLORS = ['#D63B5A', '#E0846A', '#F4C842', '#7BC67A', '#4EA86A'];

const EMOTION_CHIPS = [
  'Anxious', 'Overwhelmed', 'Hopeful', 'Happy', 'Tearful',
  'Numb', 'Irritable', 'Peaceful', 'Lonely', 'Loved', 'Excited', 'Exhausted',
];

const POSITIVE_CHIP_EMOTIONS = new Set(['Hopeful', 'Happy', 'Peaceful', 'Loved', 'Excited']);

const CRISIS_PATTERNS = [
  /\bsuicid/i, /\bself.?harm/i, /\bhurt\s+(myself|me)\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live)/i, /\bend\s+(it\s+all|my\s+life)\b/i,
  /\bwish\s+i\s+(was|were)\s+dead/i, /\bno\s+reason\s+to\s+live/i,
];

function isCrisisText(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

interface Resource {
  country: string[];
  org: string;
  desc: string;
  phone: string;
  url?: string;
}

const RESOURCES: Resource[] = [
  {
    country: ['GB', 'IE', '__'],
    org: 'Samaritans',
    desc: 'Confidential support 24/7',
    phone: '116 123',
    url: 'https://www.samaritans.org',
  },
  {
    country: ['GB', '__'],
    org: 'PANDAS Foundation',
    desc: 'Perinatal mental health support',
    phone: '0808 1961 776',
    url: 'https://pandasfoundation.org.uk',
  },
  {
    country: ['US', '__'],
    org: 'Postpartum Support International',
    desc: 'Perinatal mental health helpline',
    phone: '1-800-944-4773',
    url: 'https://www.postpartum.net',
  },
  {
    country: ['US', '__'],
    org: '988 Lifeline',
    desc: 'Crisis and suicide prevention 24/7',
    phone: '988',
  },
  {
    country: ['AU', '__'],
    org: 'PANDA',
    desc: 'Perinatal Anxiety & Depression Australia',
    phone: '1300 726 306',
    url: 'https://panda.org.au',
  },
  {
    country: ['AU', '__'],
    org: 'Beyond Blue',
    desc: 'Anxiety and low mood support',
    phone: '1300 22 4636',
    url: 'https://www.beyondblue.org.au',
  },
  {
    country: ['CA', '__'],
    org: 'Postpartum Support International (Canada)',
    desc: 'Perinatal mental health',
    phone: '1-800-944-4773',
  },
  {
    country: ['NZ', '__'],
    org: 'Lifeline',
    desc: '24/7 crisis support',
    phone: '0800 543 354',
  },
];

function getResources(country?: string): Resource[] {
  const code = (country || '').toUpperCase();
  return RESOURCES.filter((r) => r.country.includes(code) || r.country.includes('__'));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function weeklyMoodSummary(history: MoodDataPoint[]): string | null {
  const last7 = history.filter((d) => {
    const dDate = new Date(d.date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return dDate >= cutoff;
  });
  if (last7.length < 2) return null;

  const avg = last7.reduce((s, d) => s + d.avg_score, 0) / last7.length;
  const low = last7.filter((d) => d.avg_score <= 2).length;
  const high = last7.filter((d) => d.avg_score >= 4).length;

  if (avg >= 4.2) return `You've had a really beautiful week. Mostly feeling ${high >= 5 ? 'great' : 'positive'} — keep nurturing yourself. 🌸`;
  if (avg >= 3.5) return `A mostly good week with some mixed moments. ${high > low ? "More highs than lows" : "You showed up every day"} — that counts.`;
  if (avg >= 3) return `This week had its ups and downs. ${low > 0 ? `${low} tougher day${low > 1 ? 's' : ''}, but` : ''} you kept checking in, which takes courage.`;
  if (avg >= 2) return `It's been a harder week, with some tough days. You're not alone in finding this season difficult.`;
  return `It looks like this week has been really challenging. Reaching out for extra support right now could make a real difference.`;
}

function scoreColor(score: number): string {
  return SCORE_COLORS[Math.round(score) - 1] ?? colors.textMuted;
}

// ── SVG Mood Line Chart ───────────────────────────────────────────────────────

interface MoodChartProps {
  data: MoodDataPoint[];
  width: number;
}

function MoodLineChart({ data, width }: MoodChartProps) {
  const H = 130;
  const PAD = { top: 16, bottom: 28, left: 8, right: 8 };
  const cw = width - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (!data.length) {
    return (
      <View style={[{ width, height: H }, styles.chartEmpty]}>
        <Text style={styles.chartEmptyText}>No data yet — start checking in daily</Text>
      </View>
    );
  }

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cw;
  const yScale = (score: number) => PAD.top + ch - ((score - 1) / 4) * ch;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.avg_score)}`).join(' ');

  // Date labels: first, middle, last
  const labelIdxs = [0, Math.floor(data.length / 2), data.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i && v < data.length
  );
  const fmtDate = (s: string) => {
    const d = new Date(s);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <Svg width={width} height={H}>
      {/* Horizontal grid lines at y=1,2,3,4,5 */}
      {[1, 2, 3, 4, 5].map((v) => (
        <Line
          key={v}
          x1={PAD.left} y1={yScale(v)} x2={PAD.left + cw} y2={yScale(v)}
          stroke={colors.border} strokeWidth={0.5}
        />
      ))}
      {/* Connecting line */}
      {data.length > 1 && (
        <Polyline
          points={points}
          fill="none"
          stroke={colors.roseMid}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* Data point circles */}
      {data.map((d, i) => (
        <Circle
          key={d.date}
          cx={xScale(i)}
          cy={yScale(d.avg_score)}
          r={4}
          fill={scoreColor(d.avg_score)}
          stroke={colors.white}
          strokeWidth={1.5}
        />
      ))}
      {/* Date labels */}
      {labelIdxs.map((i) => (
        <SVGText
          key={i}
          x={xScale(i)}
          y={H - 6}
          fontSize={9}
          fill={colors.textMuted}
          textAnchor="middle"
        >
          {fmtDate(data[i].date)}
        </SVGText>
      ))}
    </Svg>
  );
}

// ── AI Response Card ──────────────────────────────────────────────────────────

function AIResponseCard({
  analysis,
  score,
  onTalkToBloom,
}: {
  analysis: { riskLevel: string; reflection: string; suggestions?: string[]; crisis?: boolean };
  score: number;
  onTalkToBloom: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  }, []);

  const isCrisis = analysis.crisis || analysis.riskLevel === 'crisis';
  const isLow = analysis.riskLevel === 'elevated' || analysis.riskLevel === 'high';

  return (
    <Animated.View style={[
      styles.aiCard,
      isCrisis && styles.aiCardCrisis,
      isLow && !isCrisis && styles.aiCardLow,
      { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] },
    ]}>
      <View style={styles.aiCardHeader}>
        <Text style={styles.aiCardEmoji}>🌸</Text>
        <Text style={styles.aiCardTitle}>
          {isCrisis ? 'You\'re not alone' : score >= 4 ? 'Bloom says' : score <= 2 ? 'We\'re here with you' : 'Bloom says'}
        </Text>
      </View>
      <Text style={styles.aiCardText}>{analysis.reflection}</Text>
      {analysis.suggestions?.slice(0, 2).map((s, i) => (
        <Text key={i} style={styles.aiCardSuggestion}>• {s}</Text>
      ))}
      {score <= 2 && !isCrisis && (
        <TouchableOpacity style={styles.aiCardBtn} onPress={onTalkToBloom}>
          <Text style={styles.aiCardBtnText}>Would you like to talk about it? →</Text>
        </TouchableOpacity>
      )}
      {isCrisis && (
        <TouchableOpacity style={styles.crisisCallBtn} onPress={() => Linking.openURL('tel:116123')}>
          <Ionicons name="call" size={15} color={colors.white} />
          <Text style={styles.crisisCallText}>Call Samaritans: 116 123</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── Tough Time Card ───────────────────────────────────────────────────────────

function ToughTimeCard({ onTalkToBloom }: { onTalkToBloom: () => void }) {
  return (
    <View style={styles.toughCard}>
      <Text style={styles.toughCardTitle}>You've been having a tough time.</Text>
      <Text style={styles.toughCardText}>
        You're not alone. Many people experience low moods during pregnancy and the postnatal period.
        It doesn't mean you're failing — it means you're human.
      </Text>
      <TouchableOpacity style={styles.toughCardBtn} onPress={onTalkToBloom}>
        <Ionicons name="chatbubble-ellipses" size={16} color={colors.white} />
        <Text style={styles.toughCardBtnText}>Talk to Bloom</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Crisis Card ───────────────────────────────────────────────────────────────

function CrisisCard() {
  return (
    <View style={styles.crisisCard}>
      <Text style={styles.crisisCardTitle}>💙 If you're in crisis right now</Text>
      <Text style={styles.crisisCardText}>
        Your feelings are valid and you deserve support. Please reach out — you don't have to face this alone.
      </Text>
      <TouchableOpacity
        style={styles.crisisCallBtn}
        onPress={() => Linking.openURL('tel:116123')}
      >
        <Ionicons name="call" size={15} color={colors.white} />
        <Text style={styles.crisisCallText}>Call Samaritans: 116 123 (free, 24/7)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.crisisCallBtn, { backgroundColor: colors.lavender, marginTop: spacing.xs }]}
        onPress={() => Linking.openURL('tel:999')}
      >
        <Ionicons name="call" size={15} color={colors.white} />
        <Text style={styles.crisisCallText}>Emergency services: 999 / 911 / 112</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MentalHealthScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { moodHistory, streak, todayEntry, todayAnalysis, consecutiveLowDays, status } =
    useAppSelector((s) => s.mentalHealth);
  const { profile } = useAppSelector((s) => s.profile);

  const [journalText, setJournalText] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [showCrisisCard, setShowCrisisCard] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);
  const [resourcesExpanded, setResourcesExpanded] = useState(false);

  const isSubmitting = status === 'submitting';
  const chartWidth = width - spacing.md * 2;

  useEffect(() => {
    dispatch(loadMoodHistory());
    dispatch(loadMoodStreak());
    dispatch(loadTodayMood());
  }, [dispatch]);

  const handleMoodTap = useCallback((score: number) => {
    if (todayEntry) return; // already logged
    setPendingScore(score);
  }, [todayEntry]);

  const handleSubmitCheckin = useCallback(() => {
    if (!pendingScore || isSubmitting) return;
    const moodFace = MOOD_FACES.find((f) => f.score === pendingScore);

    // Crisis check on journal before submit
    if (isCrisisText(journalText)) {
      setShowCrisisCard(true);
    }

    dispatch(submitMoodCheckin({
      mood: moodFace?.label.toLowerCase() ?? 'okay',
      moodScore: pendingScore,
      emotions: selectedEmotions,
      note: journalText,
    }));
  }, [pendingScore, isSubmitting, journalText, selectedEmotions, dispatch]);

  const handleSaveJournal = useCallback(() => {
    if (!journalText.trim() || isSubmitting) return;
    if (isCrisisText(journalText)) {
      setShowCrisisCard(true);
    }
    if (!pendingScore && !todayEntry) return;
    // If already checked in, update with journal
    dispatch(submitMoodCheckin({
      mood: MOOD_FACES.find((f) => f.score === (todayEntry?.mood_score ?? 3))?.label.toLowerCase() ?? 'okay',
      moodScore: todayEntry?.mood_score ?? 3,
      emotions: selectedEmotions,
      note: journalText,
    }));
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 3000);
  }, [journalText, selectedEmotions, isSubmitting, pendingScore, todayEntry, dispatch]);

  const toggleEmotion = useCallback((emotion: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion]
    );
  }, []);

  const handleTalkToBloom = useCallback(() => {
    router.push('/(tabs)/chat');
  }, [router]);

  const weeklySummary = useMemo(() => weeklyMoodSummary(moodHistory), [moodHistory]);
  const resources = useMemo(() => getResources(profile?.country), [profile?.country]);

  const activeScore = todayEntry?.mood_score ?? pendingScore;
  const hasLoggedToday = !!todayEntry;
  const showToughTimeCard = consecutiveLowDays >= 3 && (activeScore ?? 5) <= 2;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Wellbeing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Streak */}
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>
              {streak === 1
                ? 'You checked in today!'
                : `${streak}-day check-in streak`}
            </Text>
          </View>
        )}

        {/* Mood chart */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Last 30 days</Text>
          <View style={styles.chartLegend}>
            {MOOD_FACES.map((f) => (
              <View key={f.score} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: f.color }]} />
                <Text style={styles.legendLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
          <MoodLineChart data={moodHistory} width={chartWidth} />
        </View>

        {/* Weekly AI summary */}
        {weeklySummary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This week</Text>
            <Text style={styles.summaryText}>{weeklySummary}</Text>
          </View>
        )}

        {/* Today's mood check-in */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          {hasLoggedToday && (
            <Text style={styles.checkedInNote}>
              {`You logged ${todayEntry!.mood} today ✓`}
            </Text>
          )}
          <View style={styles.facesRow}>
            {MOOD_FACES.map((f) => {
              const isSelected = activeScore === f.score;
              return (
                <TouchableOpacity
                  key={f.score}
                  style={[styles.faceBtn, isSelected && { backgroundColor: f.color + '22' }]}
                  onPress={() => handleMoodTap(f.score)}
                  disabled={hasLoggedToday}
                >
                  <Text style={[styles.faceEmoji, isSelected && styles.faceEmojiSelected]}>
                    {f.emoji}
                  </Text>
                  <Text style={[styles.faceLabel, isSelected && { color: f.color, fontWeight: '600' }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {pendingScore && !hasLoggedToday && (
            <TouchableOpacity
              style={[styles.logBtn, isSubmitting && styles.logBtnDisabled]}
              onPress={handleSubmitCheckin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.logBtnText}>Log how I'm feeling</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* AI response after logging */}
        {todayAnalysis && (
          <AIResponseCard
            analysis={todayAnalysis}
            score={todayEntry?.mood_score ?? 3}
            onTalkToBloom={handleTalkToBloom}
          />
        )}

        {/* Low mood streak card */}
        {showToughTimeCard && (
          <ToughTimeCard onTalkToBloom={handleTalkToBloom} />
        )}

        {/* Crisis card (journal-triggered) */}
        {showCrisisCard && <CrisisCard />}

        {/* Journal + Feelings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Journal</Text>
          <Text style={styles.sectionSubtitle}>Your thoughts stay private. Write freely.</Text>
          <TextInput
            style={styles.journalInput}
            placeholder="What's on your mind today?"
            placeholderTextColor={colors.textLight}
            value={journalText}
            onChangeText={(t) => {
              setJournalText(t);
              if (isCrisisText(t)) setShowCrisisCard(true);
            }}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Feelings</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply</Text>
          <View style={styles.chipsWrap}>
            {EMOTION_CHIPS.map((emotion) => {
              const active = selectedEmotions.includes(emotion);
              const isPositive = POSITIVE_CHIP_EMOTIONS.has(emotion);
              return (
                <TouchableOpacity
                  key={emotion}
                  style={[
                    styles.emotionChip,
                    active && (isPositive ? styles.emotionChipPositive : styles.emotionChipActive),
                  ]}
                  onPress={() => toggleEmotion(emotion)}
                >
                  <Text style={[
                    styles.emotionChipText,
                    active && (isPositive ? styles.emotionChipTextPositive : styles.emotionChipTextActive),
                  ]}>
                    {emotion}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.logBtn, (journalSaved) && styles.logBtnSaved]}
            onPress={handleSaveJournal}
            disabled={isSubmitting || !journalText.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.logBtnText}>
                {journalSaved ? 'Saved ✓' : 'Save journal entry'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Resources */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.resourcesHeader}
            onPress={() => setResourcesExpanded((v) => !v)}
          >
            <View>
              <Text style={styles.sectionTitle}>If you need support</Text>
              <Text style={styles.sectionSubtitle}>Free, confidential helplines</Text>
            </View>
            <Ionicons
              name={resourcesExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {resourcesExpanded && (
            <View style={styles.resourcesList}>
              {resources.map((r) => (
                <View key={r.org} style={styles.resourceItem}>
                  <View style={styles.resourceText}>
                    <Text style={styles.resourceOrg}>{r.org}</Text>
                    <Text style={styles.resourceDesc}>{r.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${r.phone.replace(/\s/g, '')}`)}
                  >
                    <Ionicons name="call" size={14} color={colors.white} />
                    <Text style={styles.callBtnText}>{r.phone}</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.resourceActions}>
                <TouchableOpacity
                  style={styles.resourceActionBtn}
                  onPress={handleTalkToBloom}
                >
                  <Text style={styles.resourceActionEmoji}>🌸</Text>
                  <Text style={styles.resourceActionText}>Talk to Bloom</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resourceActionBtn}
                  onPress={() =>
                    Linking.openURL('https://www.mind.org.uk/information-support/types-of-mental-health-problems/postnatal-depression/')
                  }
                >
                  <Text style={styles.resourceActionEmoji}>🔍</Text>
                  <Text style={styles.resourceActionText}>Find a therapist</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textDeep },
  content: { padding: spacing.md, gap: spacing.md },

  // Streak
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#FFF5E6', borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FFD38A',
  },
  streakEmoji: { fontSize: 16 },
  streakText: { fontSize: 13, fontWeight: '600', color: '#7A4A00' },

  // Cards
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textDeep, marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },

  // Chart
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 10, color: colors.textMuted },
  chartEmpty: { justifyContent: 'center', alignItems: 'center' },
  chartEmptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  // Weekly summary
  summaryCard: {
    backgroundColor: colors.lavenderPale, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.lavenderLight,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.lavenderDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryText: { fontSize: 14, lineHeight: 21, color: colors.textBody },

  // Mood faces
  checkedInNote: { fontSize: 12, color: colors.success, marginBottom: spacing.sm, fontWeight: '500' },
  facesRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.sm },
  faceBtn: {
    alignItems: 'center', padding: spacing.xs, borderRadius: radius.md,
    minWidth: 56,
  },
  faceEmoji: { fontSize: 30 },
  faceEmojiSelected: { fontSize: 34 },
  faceLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },

  // Log button
  logBtn: {
    backgroundColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2, alignItems: 'center', marginTop: spacing.sm,
  },
  logBtnDisabled: { backgroundColor: colors.textLight },
  logBtnSaved: { backgroundColor: colors.success },
  logBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // AI response card
  aiCard: {
    backgroundColor: colors.surfacePink, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  aiCardCrisis: { backgroundColor: '#FFF0F2', borderColor: colors.error },
  aiCardLow: { backgroundColor: '#FFF5E6', borderColor: '#FFD38A' },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  aiCardEmoji: { fontSize: 18 },
  aiCardTitle: { fontSize: 13, fontWeight: '700', color: colors.textDeep },
  aiCardText: { fontSize: 14, lineHeight: 21, color: colors.textBody },
  aiCardSuggestion: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  aiCardBtn: { marginTop: spacing.sm },
  aiCardBtnText: { fontSize: 13, color: colors.rose, fontWeight: '600' },

  // Tough time card
  toughCard: {
    backgroundColor: '#FFF5E6', borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: '#FFD38A',
  },
  toughCardTitle: { fontSize: 15, fontWeight: '700', color: '#7A4A00', marginBottom: spacing.xs },
  toughCardText: { fontSize: 13, lineHeight: 20, color: '#7A4A00' },
  toughCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.lavender, borderRadius: radius.pill,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginTop: spacing.sm, alignSelf: 'flex-start',
  },
  toughCardBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },

  // Crisis card
  crisisCard: {
    backgroundColor: '#FFF0F2', borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: colors.error,
  },
  crisisCardTitle: { fontSize: 15, fontWeight: '700', color: colors.error, marginBottom: spacing.xs },
  crisisCardText: { fontSize: 13, lineHeight: 20, color: colors.textBody, marginBottom: spacing.sm },
  crisisCallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.error, borderRadius: radius.pill,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  crisisCallText: { color: colors.white, fontWeight: '600', fontSize: 13 },

  // Journal + feelings
  journalInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm,
    fontSize: 14, color: colors.textBody, minHeight: 96,
    lineHeight: 22,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  emotionChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    backgroundColor: colors.bg,
  },
  emotionChipActive: { backgroundColor: colors.roseLight, borderColor: colors.rose },
  emotionChipPositive: { backgroundColor: '#E8F5ED', borderColor: colors.success },
  emotionChipText: { fontSize: 13, color: colors.textBody },
  emotionChipTextActive: { color: colors.roseDark, fontWeight: '600' },
  emotionChipTextPositive: { color: '#2A7A4A', fontWeight: '600' },

  // Resources
  resourcesHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  resourcesList: { marginTop: spacing.md, gap: spacing.sm },
  resourceItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  resourceText: { flex: 1, marginRight: spacing.sm },
  resourceOrg: { fontSize: 13, fontWeight: '700', color: colors.textDeep },
  resourceDesc: { fontSize: 11, color: colors.textMuted },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
  },
  callBtnText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  resourceActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm,
  },
  resourceActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm, justifyContent: 'center',
  },
  resourceActionEmoji: { fontSize: 16 },
  resourceActionText: { fontSize: 12, color: colors.textBody, fontWeight: '600' },
});
