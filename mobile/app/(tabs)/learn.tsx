// app/(tabs)/learn.tsx
// Baby Development screen — "This Week" and "All Weeks" timeline views.

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Share,
  Modal,
  Animated,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchDevelopmentWeek,
  setViewedWeek,
  toggleUnits,
  type FullWeekContent,
} from '../../store/developmentSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';
import BabyIllustration from '../../components/development/BabyIllustration';

// ─── Baby size table ──────────────────────────────────────────────────────────

interface SizeEntry {
  fruit: string;
  emoji: string;
  cm: number;
  g: number;
  inches: number;
  oz: number;
  funComparison: string;
}

const SIZE_TABLE: Record<number, SizeEntry> = {
  4:  { fruit: 'poppy seed',       emoji: '🌱', cm: 0.1,  g: 0,    inches: 0.04, oz: 0,    funComparison: 'a grain of sugar' },
  5:  { fruit: 'sesame seed',      emoji: '🫘', cm: 0.13, g: 0,    inches: 0.05, oz: 0,    funComparison: 'a grain of rice' },
  6:  { fruit: 'lentil',           emoji: '🫘', cm: 0.6,  g: 0,    inches: 0.25, oz: 0,    funComparison: 'a small pea' },
  7:  { fruit: 'blueberry',        emoji: '🫐', cm: 1.0,  g: 0,    inches: 0.4,  oz: 0,    funComparison: 'a pencil eraser' },
  8:  { fruit: 'raspberry',        emoji: '🍇', cm: 1.6,  g: 1,    inches: 0.6,  oz: 0.04, funComparison: 'a kidney bean' },
  9:  { fruit: 'cherry',           emoji: '🍒', cm: 2.3,  g: 2,    inches: 0.9,  oz: 0.07, funComparison: 'a grape' },
  10: { fruit: 'strawberry',       emoji: '🍓', cm: 3.1,  g: 4,    inches: 1.2,  oz: 0.14, funComparison: 'a small lime wedge' },
  11: { fruit: 'lime',             emoji: '🍋', cm: 4.1,  g: 7,    inches: 1.6,  oz: 0.25, funComparison: 'a large fig' },
  12: { fruit: 'plum',             emoji: '🍑', cm: 5.4,  g: 14,   inches: 2.1,  oz: 0.49, funComparison: 'a ping-pong ball' },
  13: { fruit: 'peach',            emoji: '🍑', cm: 7.4,  g: 23,   inches: 2.9,  oz: 0.81, funComparison: 'a computer mouse' },
  14: { fruit: 'lemon',            emoji: '🍋', cm: 8.7,  g: 43,   inches: 3.4,  oz: 1.52, funComparison: 'a large egg' },
  15: { fruit: 'apple',            emoji: '🍎', cm: 10.1, g: 70,   inches: 4.0,  oz: 2.47, funComparison: 'a deck of cards' },
  16: { fruit: 'avocado',          emoji: '🥑', cm: 11.6, g: 100,  inches: 4.6,  oz: 3.5,  funComparison: 'an avocado' },
  17: { fruit: 'pear',             emoji: '🍐', cm: 13.0, g: 140,  inches: 5.1,  oz: 4.9,  funComparison: 'a large pear' },
  18: { fruit: 'bell pepper',      emoji: '🫑', cm: 14.2, g: 190,  inches: 5.6,  oz: 6.7,  funComparison: 'a large bell pepper' },
  19: { fruit: 'mango',            emoji: '🥭', cm: 15.3, g: 240,  inches: 6.0,  oz: 8.5,  funComparison: 'a mango' },
  20: { fruit: 'banana',           emoji: '🍌', cm: 25.6, g: 300,  inches: 10.1, oz: 10.6, funComparison: 'a banana' },
  21: { fruit: 'carrot',           emoji: '🥕', cm: 26.7, g: 360,  inches: 10.5, oz: 12.7, funComparison: 'a large carrot' },
  22: { fruit: 'papaya',           emoji: '🍈', cm: 27.8, g: 430,  inches: 10.9, oz: 15.2, funComparison: 'a spaghetti squash' },
  23: { fruit: 'grapefruit',       emoji: '🍊', cm: 28.9, g: 501,  inches: 11.4, oz: 17.7, funComparison: 'a Barbie doll' },
  24: { fruit: 'ear of corn',      emoji: '🌽', cm: 30.0, g: 600,  inches: 11.8, oz: 21.2, funComparison: 'a football' },
  25: { fruit: 'cauliflower',      emoji: '🥦', cm: 34.6, g: 660,  inches: 13.6, oz: 23.3, funComparison: 'a rutabaga' },
  26: { fruit: 'head of lettuce',  emoji: '🥬', cm: 35.6, g: 760,  inches: 14.0, oz: 26.8, funComparison: 'an average head of lettuce' },
  27: { fruit: 'broccoli head',    emoji: '🥦', cm: 36.6, g: 875,  inches: 14.4, oz: 30.9, funComparison: 'a head of broccoli' },
  28: { fruit: 'eggplant',         emoji: '🍆', cm: 37.6, g: 1005, inches: 14.8, oz: 35.4, funComparison: 'a large eggplant' },
  29: { fruit: 'butternut squash', emoji: '🎃', cm: 38.6, g: 1153, inches: 15.2, oz: 40.7, funComparison: 'a butternut squash' },
  30: { fruit: 'cabbage',          emoji: '🥬', cm: 39.9, g: 1319, inches: 15.7, oz: 46.5, funComparison: 'a head of cabbage' },
  31: { fruit: 'coconut',          emoji: '🥥', cm: 41.1, g: 1502, inches: 16.2, oz: 53.0, funComparison: 'a coconut' },
  32: { fruit: 'jicama',           emoji: '🫙', cm: 42.4, g: 1702, inches: 16.7, oz: 60.0, funComparison: 'a jicama' },
  33: { fruit: 'pineapple',        emoji: '🍍', cm: 43.7, g: 1918, inches: 17.2, oz: 67.7, funComparison: 'a pineapple' },
  34: { fruit: 'cantaloupe',       emoji: '🍈', cm: 45.0, g: 2146, inches: 17.7, oz: 75.7, funComparison: 'a cantaloupe' },
  35: { fruit: 'honeydew melon',   emoji: '🍈', cm: 46.2, g: 2383, inches: 18.2, oz: 84.0, funComparison: 'a honeydew melon' },
  36: { fruit: 'head of romaine',  emoji: '🥬', cm: 47.4, g: 2622, inches: 18.7, oz: 92.5, funComparison: 'a large romaine head' },
  37: { fruit: 'winter melon',     emoji: '🍉', cm: 48.6, g: 2859, inches: 19.1, oz: 100.9, funComparison: 'a mini watermelon' },
  38: { fruit: 'leek',             emoji: '🌿', cm: 49.8, g: 3083, inches: 19.6, oz: 108.7, funComparison: 'a bunch of leeks' },
  39: { fruit: 'watermelon',       emoji: '🍉', cm: 50.7, g: 3288, inches: 20.0, oz: 116.0, funComparison: 'a small watermelon' },
  40: { fruit: 'small pumpkin',    emoji: '🎃', cm: 51.2, g: 3462, inches: 20.2, oz: 122.1, funComparison: 'a small pumpkin' },
};

function getSize(week: number): SizeEntry {
  return SIZE_TABLE[Math.min(40, Math.max(4, week))] ?? SIZE_TABLE[12];
}

// ─── Trimester helper ─────────────────────────────────────────────────────────

function trimesterOf(week: number): { label: string; color: string; bg: string } {
  if (week <= 13) return { label: '1st Trimester', color: colors.roseDark,    bg: colors.roseLight };
  if (week <= 26) return { label: '2nd Trimester', color: colors.lavenderDark, bg: colors.lavenderLight };
  return               { label: '3rd Trimester', color: '#0D6E8A',            bg: '#E0F4FA' };
}

// ─── Content normalisers ──────────────────────────────────────────────────────

function getHighlights(c: FullWeekContent): Array<{ system: string; detail: string }> {
  return c.development_highlights ?? c.developmentHighlights ?? [];
}

function getSymptoms(c: FullWeekContent): string[] {
  const raw = c.common_symptoms ?? c.commonSymptoms ?? [];
  return raw.map((s) => (typeof s === 'string' ? s : s.name));
}

function getMomChanges(c: FullWeekContent): string[] {
  const raw = c.mom_body_changes ?? c.momBodyChanges ?? [];
  return raw.map((s) => (typeof s === 'string' ? s : `${s.change}${s.detail ? ` — ${s.detail}` : ''}`));
}

function getTip(c: FullWeekContent): { title: string; body: string } | null {
  const raw = c.weekly_tip ?? c.weeklyTip;
  if (!raw) return null;
  if (typeof raw === 'string') return { title: "This Week's Tip", body: raw };
  return raw;
}

function getDoctorQuestions(c: FullWeekContent): string[] {
  return c.doctor_questions ?? c.doctorQuestions ?? [];
}

// ─── Share modal ──────────────────────────────────────────────────────────────

function ShareModal({
  week,
  size,
  onClose,
}: {
  week: number;
  size: SizeEntry;
  onClose: () => void;
}) {
  const tri = trimesterOf(week);

  async function doShare() {
    const msg = [
      `${size.emoji} Week ${week} pregnancy update!`,
      ``,
      `Baby is the size of a ${size.fruit} ${size.emoji}`,
      `📏 ${size.cm} cm · ⚖️ ${size.g > 0 ? size.g + 'g' : 'too tiny to weigh yet'}`,
      ``,
      `${tri.label} · Tracked with Bloom 🌸`,
    ].join('\n');

    try {
      await Share.share({ message: msg, title: `Week ${week} — Baby is the size of a ${size.fruit}!` });
    } catch {
      // user dismissed
    }
    onClose();
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={sm.backdrop}>
        <View style={sm.card}>
          {/* Share card preview */}
          <View style={sm.preview}>
            <View style={sm.previewGradTop} />
            <Text style={sm.previewWeek}>Week {week}</Text>
            <Text style={sm.previewEmoji}>{size.emoji}</Text>
            <Text style={sm.previewFruit}>Size of a {size.fruit}</Text>
            <View style={sm.previewRow}>
              <View style={sm.previewPill}>
                <Text style={sm.previewPillTxt}>📏 {size.cm} cm</Text>
              </View>
              {size.g > 0 && (
                <View style={sm.previewPill}>
                  <Text style={sm.previewPillTxt}>⚖️ {size.g}g</Text>
                </View>
              )}
            </View>
            <Text style={sm.previewBrand}>Bloom 🌸</Text>
          </View>

          <TouchableOpacity style={sm.shareBtn} onPress={doShare}>
            <Ionicons name="share-social-outline" size={18} color={colors.white} style={{ marginRight: 8 }} />
            <Text style={sm.shareBtnTxt}>Share to Instagram / WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sm.cancelBtn} onPress={onClose}>
            <Text style={sm.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card:           { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg, paddingBottom: 40 },
  preview:        { backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg, overflow: 'hidden' },
  previewGradTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 60, backgroundColor: colors.roseLight, opacity: 0.5 },
  previewWeek:    { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  previewEmoji:   { fontSize: 72, marginBottom: 8 },
  previewFruit:   { fontSize: 22, fontWeight: '800', color: colors.textDeep, marginBottom: 12 },
  previewRow:     { flexDirection: 'row', gap: 8, marginBottom: 12 },
  previewPill:    { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, ...shadow.sm },
  previewPillTxt: { fontSize: 14, fontWeight: '600', color: colors.textBody },
  previewBrand:   { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  shareBtn:       { backgroundColor: colors.rose, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginBottom: spacing.sm },
  shareBtnTxt:    { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn:      { alignItems: 'center', padding: spacing.sm },
  cancelTxt:      { color: colors.textMuted, fontSize: 15 },
});

// ─── Content card components ──────────────────────────────────────────────────

function ContentCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={cc.card}>
      <View style={cc.header}>
        <Text style={cc.icon}>{icon}</Text>
        <Text style={cc.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const cc = StyleSheet.create({
  card:   { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  icon:   { fontSize: 20 },
  title:  { fontSize: 16, fontWeight: '800', color: colors.textDeep, flex: 1 },
});

// Bullet row
function Bullet({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 10, gap: 10 }}>
      <Text style={{ fontSize: 18, marginTop: 1 }}>{icon}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: colors.textBody, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

// Symptom chip
function SymptomChip({ label }: { label: string }) {
  return (
    <View style={sc.chip}>
      <Text style={sc.txt}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  chip: { backgroundColor: colors.roseLight, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, margin: 3 },
  txt:  { fontSize: 13, color: colors.roseDark, fontWeight: '600' },
});

// ─── Skeleton for content section ────────────────────────────────────────────

function Shimmer({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: radius.md, backgroundColor: colors.border, opacity }, style]}
    />
  );
}

function ContentSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.md }}>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }, shadow.sm]}>
          <Shimmer width={140} height={16} style={{ marginBottom: 12 }} />
          <Shimmer width="90%" height={13} style={{ marginBottom: 8 }} />
          <Shimmer width="75%" height={13} style={{ marginBottom: 8 }} />
          <Shimmer width="82%" height={13} />
        </View>
      ))}
    </View>
  );
}

// ─── Week selector item ───────────────────────────────────────────────────────

const ITEM_W = 60;

function WeekItem({
  week,
  currentWeek,
  viewedWeek,
  isPremiumLocked,
  onPress,
}: {
  week: number;
  currentWeek: number;
  viewedWeek: number;
  isPremiumLocked: boolean;
  onPress: () => void;
}) {
  const isViewed  = week === viewedWeek;
  const isPast    = week < currentWeek;
  const isCurrent = week === currentWeek;

  return (
    <TouchableOpacity
      style={[
        ws.item,
        isViewed   && ws.itemViewed,
        isCurrent  && ws.itemCurrent,
        isPast && !isViewed && ws.itemPast,
        isPremiumLocked && ws.itemLocked,
      ]}
      onPress={onPress}
      disabled={isPremiumLocked}
      activeOpacity={0.7}
    >
      {isPremiumLocked ? (
        <Ionicons name="lock-closed" size={14} color={colors.textLight} />
      ) : (
        <>
          <Text style={[ws.weekNum, isViewed && ws.weekNumActive, isPast && !isViewed && ws.weekNumPast]}>
            {week}
          </Text>
          {(isPast || isCurrent) && !isViewed && (
            <View style={ws.dot} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const ws = StyleSheet.create({
  item:         { width: ITEM_W, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, marginHorizontal: 3 },
  itemViewed:   { backgroundColor: colors.rose },
  itemCurrent:  { borderWidth: 2, borderColor: colors.rose },
  itemPast:     { backgroundColor: colors.borderLight },
  itemLocked:   { backgroundColor: colors.borderLight, opacity: 0.5 },
  weekNum:      { fontSize: 15, fontWeight: '700', color: colors.textDeep },
  weekNumActive:{ color: colors.white },
  weekNumPast:  { color: colors.textMuted },
  dot:          { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.roseMid, marginTop: 3 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

const FREE_WEEKS = 13; // weeks 1-13 free, 14+ premium-locked (demo gate)

export default function BabyDevelopmentScreen() {
  const dispatch     = useAppDispatch();
  const profile      = useAppSelector((s) => s.profile.profile);
  const { cache, loading, viewedWeek, units } = useAppSelector((s) => s.development);

  const currentWeek  = profile?.currentWeek ?? 12;
  const [tab, setTab]            = useState<'week' | 'timeline'>('week');
  const [showShare, setShowShare] = useState(false);

  const timelineRef  = useRef<FlatList>(null);
  const content      = cache[viewedWeek] as FullWeekContent | undefined;
  const size         = getSize(viewedWeek);
  const tri          = trimesterOf(viewedWeek);

  // Initialise viewed week to current week
  useEffect(() => {
    dispatch(setViewedWeek(currentWeek));
  }, [currentWeek]);

  // Fetch when viewed week changes
  useEffect(() => {
    dispatch(fetchDevelopmentWeek(viewedWeek));
  }, [viewedWeek]);

  // Scroll timeline to current week on mount / tab switch
  useEffect(() => {
    if (tab === 'timeline') {
      setTimeout(() => {
        timelineRef.current?.scrollToIndex({
          index: Math.max(0, viewedWeek - 3),
          animated: true,
        });
      }, 150);
    }
  }, [tab, viewedWeek]);

  const handleWeekSelect = useCallback((week: number) => {
    dispatch(setViewedWeek(week));
    setTab('week');
  }, [dispatch]);

  // ── Derived content ────────────────────────────────────────────────────────
  const highlights     = content ? getHighlights(content) : [];
  const symptoms       = content ? getSymptoms(content) : [];
  const momChanges     = content ? getMomChanges(content) : [];
  const tip            = content ? getTip(content) : null;
  const doctorQs       = content ? getDoctorQuestions(content) : [];
  const headline       = content?.headline_sentence ?? content?.headlineSentence ?? '';
  const didYouKnow     = content?.did_you_know ?? content?.didYouKnow ?? '';

  const weeks = Array.from({ length: 40 }, (_, i) => i + 1);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <View style={s.topBar}>
        <Text style={s.screenTitle}>Baby Development</Text>
        <TouchableOpacity style={s.shareBtn} onPress={() => setShowShare(true)}>
          <Ionicons name="share-outline" size={20} color={colors.rose} />
        </TouchableOpacity>
      </View>

      {/* ── Tab switcher ────────────────────────────────────────────── */}
      <View style={s.tabRow}>
        {(['week', 'timeline'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'week' ? 'This Week' : 'All Weeks'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'week' ? (
        /* ════════════════════════════════════════════════════════════
           PART 1 — This week
        ═══════════════════════════════════════════════════════════════ */
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={s.hero}>
            {/* Trimester badge + week */}
            <View style={s.heroTopRow}>
              <View style={[s.triBadge, { backgroundColor: tri.bg }]}>
                <Text style={[s.triTxt, { color: tri.color }]}>{tri.label}</Text>
              </View>
              <Text style={s.heroWeekLabel}>Week {viewedWeek}</Text>
            </View>

            {/* Animated baby illustration */}
            <View style={s.babyWrap}>
              <BabyIllustration week={viewedWeek} size={220} />
            </View>

            {/* Size comparison */}
            <View style={s.sizeCard}>
              <View style={s.sizeTop}>
                <View style={s.sizeLeft}>
                  <Text style={s.sizeEmoji}>{size.emoji}</Text>
                  <View>
                    <Text style={s.sizeFruit}>Size of a {size.fruit}</Text>
                    <Text style={s.sizeFun}>Like {size.funComparison}</Text>
                  </View>
                </View>
                {/* Metric / imperial toggle */}
                <TouchableOpacity style={s.unitToggle} onPress={() => dispatch(toggleUnits())}>
                  <Text style={s.unitTxt}>{units === 'metric' ? 'cm / g' : 'in / oz'}</Text>
                  <Ionicons name="swap-horizontal" size={14} color={colors.rose} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
              <View style={s.sizeMeasures}>
                <View style={s.measurePill}>
                  <Text style={s.measureLabel}>Length</Text>
                  <Text style={s.measureVal}>
                    {units === 'metric' ? `${size.cm} cm` : `${size.inches}"`}
                  </Text>
                </View>
                {size.g > 0 && (
                  <View style={s.measurePill}>
                    <Text style={s.measureLabel}>Weight</Text>
                    <Text style={s.measureVal}>
                      {units === 'metric' ? `${size.g} g` : `${size.oz} oz`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ── Content cards ────────────────────────────────────── */}
          <View style={{ paddingHorizontal: spacing.md }}>
            {loading && !content ? (
              <ContentSkeleton />
            ) : (
              <>
                {/* Card 1 — What's developing */}
                <ContentCard icon="🧬" title="What's developing">
                  {headline ? (
                    <Text style={s.cardHeadline}>{headline}</Text>
                  ) : null}
                  {highlights.length > 0 ? (
                    highlights.map((h, i) => (
                      <Bullet key={i} icon={systemIcon(h.system)} text={`${h.system}: ${h.detail}`} />
                    ))
                  ) : (
                    <Text style={s.emptyTxt}>Week development details loading…</Text>
                  )}
                  {didYouKnow ? (
                    <View style={s.dyk}>
                      <Text style={s.dykLabel}>💡 Did you know?</Text>
                      <Text style={s.dykTxt}>{didYouKnow}</Text>
                    </View>
                  ) : null}
                </ContentCard>

                {/* Card 2 — How you might feel */}
                {symptoms.length > 0 && (
                  <ContentCard icon="💆" title="How you might feel">
                    <View style={s.chipWrap}>
                      {symptoms.map((sym, i) => (
                        <SymptomChip key={i} label={sym} />
                      ))}
                    </View>
                  </ContentCard>
                )}

                {/* Card 3 — Your body this week */}
                {momChanges.length > 0 && (
                  <ContentCard icon="🤰" title="Your body this week">
                    {momChanges.map((change, i) => (
                      <Bullet key={i} icon="✨" text={change} />
                    ))}
                  </ContentCard>
                )}

                {/* Card 4 — This week's tip */}
                {tip && (
                  <ContentCard icon="💡" title={tip.title}>
                    <Text style={s.tipBody}>{tip.body}</Text>
                  </ContentCard>
                )}

                {/* Card 5 — Ask your doctor */}
                {doctorQs.length > 0 && (
                  <ContentCard icon="👩‍⚕️" title="Ask your doctor">
                    {doctorQs.map((q, i) => (
                      <View key={i} style={s.doctorQ}>
                        <View style={s.doctorQNum}>
                          <Text style={s.doctorQNumTxt}>{i + 1}</Text>
                        </View>
                        <Text style={s.doctorQTxt}>{q}</Text>
                      </View>
                    ))}
                  </ContentCard>
                )}

                {/* Empty state */}
                {!loading && !content && (
                  <View style={s.emptyCard}>
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
                    <Text style={s.emptyCardTxt}>
                      Week {viewedWeek} content is being personalised for you.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      ) : (
        /* ════════════════════════════════════════════════════════════
           PART 2 — Timeline / All Weeks
        ═══════════════════════════════════════════════════════════════ */
        <View style={{ flex: 1 }}>
          {/* Week number strip */}
          <View style={s.timelineHeader}>
            <Text style={s.timelineHint}>Tap a week to explore · Week {currentWeek} highlighted</Text>
          </View>
          <FlatList
            ref={timelineRef}
            data={weeks}
            horizontal
            keyExtractor={(w) => String(w)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.weekStrip}
            getItemLayout={(_, index) => ({
              length: ITEM_W + 6,
              offset: (ITEM_W + 6) * index,
              index,
            })}
            renderItem={({ item: week }) => {
              const locked = week > FREE_WEEKS && week > currentWeek + 2;
              return (
                <WeekItem
                  week={week}
                  currentWeek={currentWeek}
                  viewedWeek={viewedWeek}
                  isPremiumLocked={locked}
                  onPress={() => handleWeekSelect(week)}
                />
              );
            }}
          />

          {/* Selected week preview in timeline tab */}
          <ScrollView
            contentContainerStyle={s.timelineScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Mini hero */}
            <View style={s.timelineHeroCard}>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.timelineEmoji}>{size.emoji}</Text>
                <Text style={s.timelineWeekTxt}>Week {viewedWeek}</Text>
                <View style={[s.triBadge, { backgroundColor: tri.bg, marginTop: 6 }]}>
                  <Text style={[s.triTxt, { color: tri.color }]}>{tri.label}</Text>
                </View>
              </View>
              <View style={s.timelineMeasures}>
                <View style={s.measurePill}>
                  <Text style={s.measureLabel}>Size</Text>
                  <Text style={s.measureVal}>{size.fruit}</Text>
                </View>
                <View style={s.measurePill}>
                  <Text style={s.measureLabel}>Length</Text>
                  <Text style={s.measureVal}>{units === 'metric' ? `${size.cm} cm` : `${size.inches}"`}</Text>
                </View>
                {size.g > 0 && (
                  <View style={s.measurePill}>
                    <Text style={s.measureLabel}>Weight</Text>
                    <Text style={s.measureVal}>{units === 'metric' ? `${size.g}g` : `${size.oz} oz`}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Headline */}
            {loading ? (
              <ActivityIndicator color={colors.rose} style={{ marginTop: spacing.lg }} />
            ) : (
              <>
                {headline ? (
                  <View style={s.timelineCard}>
                    <Text style={s.timelineCardTitle}>🧬 Developing this week</Text>
                    <Text style={s.timelineCardBody}>{headline}</Text>
                  </View>
                ) : null}
                {highlights.slice(0, 3).map((h, i) => (
                  <View key={i} style={s.timelineCard}>
                    <Text style={s.timelineCardTitle}>{systemIcon(h.system)} {h.system}</Text>
                    <Text style={s.timelineCardBody}>{h.detail}</Text>
                  </View>
                ))}
                <TouchableOpacity style={s.viewFullBtn} onPress={() => setTab('week')}>
                  <Text style={s.viewFullBtnTxt}>See full Week {viewedWeek} detail →</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </View>
      )}

      {/* ── Share modal ─────────────────────────────────────────── */}
      {showShare && (
        <ShareModal
          week={viewedWeek}
          size={size}
          onClose={() => setShowShare(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Icon map for body systems ────────────────────────────────────────────────

function systemIcon(system: string): string {
  const map: Record<string, string> = {
    brain: '🧠', heart: '💓', lungs: '🫁', liver: '🫀', kidneys: '🫘',
    eyes: '👁️', ears: '👂', skin: '🤲', bones: '🦴', muscles: '💪',
    digestive: '🍽️', nervous: '⚡', immune: '🛡️', reproductive: '🌸',
    respiratory: '💨', circulatory: '🩸', hair: '💇', nails: '💅',
  };
  const key = Object.keys(map).find((k) => system.toLowerCase().includes(k));
  return key ? map[key] : '✨';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xl },

  // Top bar
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  screenTitle:   { fontSize: 22, fontWeight: '900', color: colors.textDeep, letterSpacing: -0.5 },
  shareBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.roseLight, alignItems: 'center', justifyContent: 'center' },

  // Tab switcher
  tabRow:        { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.borderLight, borderRadius: radius.pill, padding: 3 },
  tabBtn:        { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.pill },
  tabBtnActive:  { backgroundColor: colors.surface, ...shadow.sm },
  tabTxt:        { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTxtActive:  { color: colors.textDeep, fontWeight: '800' },

  // Hero
  hero:          { alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  heroTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.sm },
  heroWeekLabel: { fontSize: 18, fontWeight: '900', color: colors.textDeep },
  triBadge:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  triTxt:        { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  babyWrap:      { marginVertical: spacing.sm },

  // Size card
  sizeCard:      { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, width: '100%' },
  sizeTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sizeLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sizeEmoji:     { fontSize: 32 },
  sizeFruit:     { fontSize: 16, fontWeight: '800', color: colors.textDeep },
  sizeFun:       { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  unitToggle:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.roseLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  unitTxt:       { fontSize: 12, fontWeight: '700', color: colors.rose },
  sizeMeasures:  { flexDirection: 'row', gap: spacing.sm },
  measurePill:   { flex: 1, backgroundColor: colors.bgWarm, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  measureLabel:  { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
  measureVal:    { fontSize: 15, fontWeight: '800', color: colors.textDeep },

  // Content cards
  cardHeadline:  { fontSize: 14, fontWeight: '600', color: colors.textBody, lineHeight: 20, marginBottom: 10 },
  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', margin: -3 },
  tipBody:       { fontSize: 14, color: colors.textBody, lineHeight: 22 },
  doctorQ:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  doctorQNum:    { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lavenderLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  doctorQNumTxt: { fontSize: 12, fontWeight: '800', color: colors.lavender },
  doctorQTxt:    { flex: 1, fontSize: 14, color: colors.textBody, lineHeight: 21 },
  dyk:           { backgroundColor: colors.lavenderPale, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  dykLabel:      { fontSize: 12, fontWeight: '800', color: colors.lavender, marginBottom: 4 },
  dykTxt:        { fontSize: 13, color: colors.textBody, lineHeight: 19 },

  // Empty
  emptyTxt:      { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  emptyCard:     { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', ...shadow.sm, marginBottom: spacing.md },
  emptyCardTxt:  { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Timeline
  timelineHeader:{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  timelineHint:  { fontSize: 12, color: colors.textMuted },
  weekStrip:     { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  timelineScroll:{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 60 },
  timelineHeroCard:{ ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  timelineEmoji: { fontSize: 52, marginBottom: 4 },
  timelineWeekTxt:{ fontSize: 22, fontWeight: '900', color: colors.textDeep },
  timelineMeasures:{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  timelineCard:  { ...shadow.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  timelineCardTitle:{ fontSize: 14, fontWeight: '800', color: colors.textDeep, marginBottom: 6 },
  timelineCardBody:{ fontSize: 14, color: colors.textBody, lineHeight: 21 },
  viewFullBtn:   { backgroundColor: colors.rose, borderRadius: radius.pill, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  viewFullBtnTxt:{ color: colors.white, fontWeight: '700', fontSize: 15 },
});
