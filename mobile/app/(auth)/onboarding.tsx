/**
 * app/(auth)/onboarding.tsx
 * 6-step onboarding flow for new Bloom users.
 *
 * Step 0 — Welcome
 * Step 1 — Date input  (LMP / due date / IVF)
 * Step 2 — About you  (first pregnancy, age, conditions)
 * Step 3 — Goals      (what matters most)
 * Step 4 — Location & language
 * Step 5 — Notifications
 * Step 6 — Personalising… (loading + API call)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Locale, getLocales } from 'expo-localization';

import { useAppDispatch, useAppSelector } from '../../store';
import { submitOnboarding } from '../../store/profileSlice';
import { colors, radius, shadow, spacing } from '../../constants/theme';
import { COUNTRIES, Country } from '../../constants/countries';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const TOTAL_STEPS = 6; // 0-5 are content steps; step 6 = personalising

const GOALS = [
  { key: 'track_symptoms',  emoji: '📋', title: 'Track symptoms',         desc: 'Log how you feel day by day' },
  { key: 'learn',           emoji: '📖', title: 'Learn week by week',      desc: "Follow your baby's development" },
  { key: 'community',       emoji: '🤝', title: 'Connect with others',     desc: 'Find people on the same journey' },
  { key: 'partner_connect', emoji: '💑', title: 'Share with my partner',   desc: 'Keep your support person in the loop' },
  { key: 'medical_track',   emoji: '🩺', title: 'Monitor my health',       desc: 'Track vitals and appointments' },
];

const CONDITIONS = [
  { key: 'none',                  label: 'None of the above' },
  { key: 'gestational_diabetes',  label: 'Gestational diabetes' },
  { key: 'hypertension',          label: 'Hypertension (high BP)' },
  { key: 'thyroid',               label: 'Thyroid condition' },
  { key: 'multiples',             label: 'Twin / multiple pregnancy' },
  { key: 'other',                 label: 'Other condition' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pt', label: 'Português' },
  { code: 'ur', label: 'اردو' },
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDateFromParts(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function detectLanguageCode(): string {
  try {
    const locales = getLocales();
    const code = locales[0]?.languageCode ?? 'en';
    return LANGUAGES.some((l) => l.code === code) ? code : 'en';
  } catch {
    return 'en';
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// ProgressBar
function ProgressBar({ step }: { step: number }) {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pct = step > 0 ? (step / (TOTAL_STEPS - 1)) * 100 : 0;
    Animated.timing(animWidth, {
      toValue: pct,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  if (step === 0 || step >= TOTAL_STEPS) return null;

  return (
    <View style={pb.track}>
      <Animated.View
        style={[
          pb.fill,
          {
            width: animWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: colors.lavenderLight,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.rose,
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// WheelColumn — single scrollable column for the date picker
// ──────────────────────────────────────────────────────────────────────────────

const ITEM_H = 46;
const VISIBLE = 5;

interface WheelColProps {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  colWidth: number;
}

function WheelColumn({ items, selectedIndex, onSelect, colWidth }: WheelColProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);

  // Scroll to the selected item after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedIndex) * ITEM_H,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // When parent changes selected index (e.g. days reduced) scroll to new
  useEffect(() => {
    if (!isScrolling.current) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedIndex) * ITEM_H,
        animated: true,
      });
    }
  }, [selectedIndex]);

  return (
    <View style={[wh.col, { width: colWidth }]}>
      {/* highlight band */}
      <View pointerEvents="none" style={wh.highlight} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={(e) => {
          isScrolling.current = false;
          const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(items.length - 1, idx));
          onSelect(clamped);
        }}
        scrollEventThrottle={16}
      >
        {items.map((label, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Pressable
              key={`${label}-${i}`}
              style={wh.item}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
                onSelect(i);
              }}
            >
              <Text style={[wh.itemText, isSelected && wh.itemTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wh = StyleSheet.create({
  col: {
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    top: ITEM_H * 2,
    height: ITEM_H,
    backgroundColor: colors.roseLight,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.roseMid,
    borderRadius: radius.sm,
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '400',
  },
  itemTextSelected: {
    fontSize: 18,
    color: colors.textDeep,
    fontWeight: '700',
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// DateWheelPicker
// ──────────────────────────────────────────────────────────────────────────────

interface DateWheelProps {
  day: number;
  month: number;
  year: number;
  onDayChange: (d: number) => void;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}

function DateWheelPicker({ day, month, year, onDayChange, onMonthChange, onYearChange }: DateWheelProps) {
  const thisYear = new Date().getFullYear();
  const years  = Array.from({ length: 6 }, (_, i) => String(thisYear - 2 + i));
  const maxDay = daysInMonth(month, year);
  const days   = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = MONTHS.map((m) => m.slice(0, 3));

  const dayIdx   = Math.min(day - 1, maxDay - 1);
  const monthIdx = month - 1;
  const yearIdx  = years.indexOf(String(year));

  const colW = (SCREEN_W - spacing.lg * 2 - 32) / 3;

  return (
    <View style={dwp.container}>
      <View style={dwp.colLabels}>
        {['Day', 'Month', 'Year'].map((l) => (
          <Text key={l} style={[dwp.colLabel, { width: colW }]}>{l}</Text>
        ))}
      </View>
      <View style={dwp.cols}>
        <WheelColumn
          items={days}
          selectedIndex={dayIdx}
          onSelect={(i) => onDayChange(i + 1)}
          colWidth={colW}
        />
        <WheelColumn
          items={months}
          selectedIndex={monthIdx}
          onSelect={(i) => onMonthChange(i + 1)}
          colWidth={colW}
        />
        <WheelColumn
          items={years}
          selectedIndex={yearIdx >= 0 ? yearIdx : 2}
          onSelect={(i) => onYearChange(Number(years[i]))}
          colWidth={colW}
        />
      </View>
    </View>
  );
}

const dwp = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  colLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  colLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cols: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// CountryPickerModal
// ──────────────────────────────────────────────────────────────────────────────

interface CountryPickerProps {
  visible: boolean;
  selected: string;
  onSelect: (c: Country) => void;
  onClose: () => void;
}

function CountryPickerModal({ visible, selected, onSelect, onClose }: CountryPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cp.overlay}>
        <View style={cp.sheet}>
          <View style={cp.handle} />
          <Text style={cp.title}>Select country</Text>

          <View style={cp.searchRow}>
            <Text style={cp.searchIcon}>🔍</Text>
            <TextInput
              style={cp.searchInput}
              placeholder="Search countries…"
              placeholderTextColor={colors.textLight}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="words"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[cp.row, item.code === selected && cp.rowSelected]}
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <Text style={cp.flag}>{item.flag}</Text>
                <Text style={[cp.countryName, item.code === selected && cp.countryNameSelected]}>
                  {item.name}
                </Text>
                {item.code === selected && <Text style={cp.check}>✓</Text>}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const cp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 20, 64, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDeep,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfacePink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.textDeep,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowSelected: {
    backgroundColor: colors.roseLight,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 0,
  },
  flag: { fontSize: 22, marginRight: spacing.md },
  countryName: { flex: 1, fontSize: 15, color: colors.textBody },
  countryNameSelected: { color: colors.roseDark, fontWeight: '600' },
  check: { color: colors.rose, fontSize: 16, fontWeight: '700' },
});

// ──────────────────────────────────────────────────────────────────────────────
// GoalCard
// ──────────────────────────────────────────────────────────────────────────────

interface GoalCardProps {
  emoji: string;
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}

function GoalCard({ emoji, title, desc, selected, onPress }: GoalCardProps) {
  return (
    <Pressable
      style={[gc.card, selected && gc.cardSelected]}
      onPress={onPress}
    >
      <View style={[gc.iconWrap, selected && gc.iconWrapSelected]}>
        <Text style={gc.emoji}>{emoji}</Text>
      </View>
      <View style={gc.textWrap}>
        <Text style={[gc.title, selected && gc.titleSelected]}>{title}</Text>
        <Text style={gc.desc}>{desc}</Text>
      </View>
      <View style={[gc.check, selected && gc.checkSelected]}>
        {selected && <Text style={gc.checkMark}>✓</Text>}
      </View>
    </Pressable>
  );
}

const gc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  cardSelected: {
    borderColor: colors.rose,
    backgroundColor: colors.roseLight,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconWrapSelected: { backgroundColor: colors.roseMid + '40' },
  emoji: { fontSize: 22 },
  textWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textDeep, marginBottom: 2 },
  titleSelected: { color: colors.roseDark },
  desc: { fontSize: 13, color: colors.textBody, lineHeight: 18 },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  checkSelected: { backgroundColor: colors.rose, borderColor: colors.rose },
  checkMark: { color: colors.white, fontSize: 13, fontWeight: '700' },
});

// ──────────────────────────────────────────────────────────────────────────────
// Tooltip
// ──────────────────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} style={tt.trigger}>
        <Text style={tt.icon}>ⓘ</Text>
        <Text style={tt.label}>Why do we ask?</Text>
      </Pressable>
      {open && (
        <View style={tt.bubble}>
          <Text style={tt.text}>{text}</Text>
        </View>
      )}
    </View>
  );
}

const tt = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  icon: { fontSize: 14, color: colors.lavender, marginRight: 4 },
  label: { fontSize: 13, color: colors.lavender, fontWeight: '600' },
  bubble: {
    backgroundColor: colors.lavenderLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.lavender,
  },
  text: { fontSize: 13, color: colors.textBody, lineHeight: 19 },
});

// ──────────────────────────────────────────────────────────────────────────────
// NotifRow — single notification toggle row
// ──────────────────────────────────────────────────────────────────────────────

interface NotifRowProps {
  emoji: string;
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function NotifRow({ emoji, title, desc, value, onChange }: NotifRowProps) {
  return (
    <View style={nr.row}>
      <View style={nr.iconWrap}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={nr.text}>
        <Text style={nr.title}>{title}</Text>
        <Text style={nr.desc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.roseMid }}
        thumbColor={value ? colors.rose : colors.textLight}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const nr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.roseLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textDeep, marginBottom: 2 },
  desc: { fontSize: 12, color: colors.textBody, lineHeight: 17 },
});

// ──────────────────────────────────────────────────────────────────────────────
// STEP SCREENS
// ──────────────────────────────────────────────────────────────────────────────

// Step 0 — Welcome
interface WelcomeProps {
  onStart: () => void;
  onSignIn: () => void;
}

function StepWelcome({ onStart, onSignIn }: WelcomeProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={sw.root}>
      {/* Decorative blobs */}
      <View style={sw.blobTL} />
      <View style={sw.blobBR} />

      <View style={sw.content}>
        {/* Logo */}
        <Animated.View style={[sw.logoOuter, { transform: [{ scale: pulse }] }]}>
          <View style={sw.logoInner}>
            <Text style={sw.logoEmoji}>🌸</Text>
          </View>
        </Animated.View>

        <Text style={sw.appName}>Bloom</Text>
        <Text style={sw.tagline}>Your pregnancy companion,{'\n'}wherever you are</Text>

        <View style={sw.featRow}>
          {[
            { e: '🌍', t: 'Works worldwide' },
            { e: '🔒', t: 'Private & secure' },
            { e: '🤖', t: 'AI-powered' },
          ].map(({ e, t }) => (
            <View key={t} style={sw.feat}>
              <Text style={sw.featEmoji}>{e}</Text>
              <Text style={sw.featLabel}>{t}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={sw.bottom}>
        <Pressable style={sw.btnPrimary} onPress={onStart}>
          <Text style={sw.btnPrimaryText}>Get started</Text>
        </Pressable>

        <Pressable style={sw.btnGhost} onPress={onSignIn}>
          <Text style={sw.btnGhostText}>I already have an account</Text>
        </Pressable>

        <Text style={sw.legal}>
          By continuing, you agree to our Terms & Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const sw = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  blobTL: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.lavenderLight,
    top: -80,
    left: -80,
    opacity: 0.7,
  },
  blobBR: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.roseLight,
    bottom: 120,
    right: -60,
    opacity: 0.8,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  logoOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.roseLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadow.lg,
  },
  logoInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 40 },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.textDeep,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 18,
    color: colors.textBody,
    textAlign: 'center',
    lineHeight: 27,
    marginBottom: spacing.xxl,
  },
  featRow: { flexDirection: 'row', gap: spacing.xl },
  feat: { alignItems: 'center', gap: spacing.xs },
  featEmoji: { fontSize: 24 },
  featLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },
  bottom: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.rose,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.md,
  },
  btnPrimaryText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  btnGhost: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  btnGhostText: { color: colors.textBody, fontSize: 15, fontWeight: '600' },
  legal: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 16,
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 1 — Date input
// ──────────────────────────────────────────────────────────────────────────────

type DateType = 'lmp' | 'due_date' | 'ivf_transfer';

interface StepDateProps {
  dateType: DateType;
  onDateTypeChange: (t: DateType) => void;
  day: number; month: number; year: number;
  onDayChange: (d: number) => void;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
  isIVF: boolean;
  onIVFChange: (v: boolean) => void;
}

function StepDate({
  dateType, onDateTypeChange,
  day, month, year, onDayChange, onMonthChange, onYearChange,
  isIVF, onIVFChange,
}: StepDateProps) {

  const tabs: { key: DateType; label: string }[] = [
    { key: 'lmp',          label: 'Last period' },
    { key: 'due_date',     label: 'Due date' },
    { key: 'ivf_transfer', label: 'IVF / transfer' },
  ];

  const headings: Record<DateType, string> = {
    lmp:          'When was the first day of your last period?',
    due_date:     'What is your estimated due date?',
    ivf_transfer: 'When was your embryo transfer?',
  };

  const tooltips: Record<DateType, string> = {
    lmp:          'This helps us calculate your current week and due date. Your last menstrual period (LMP) is the standard way to date a pregnancy.',
    due_date:     'If your provider has already given you a due date, enter it here. We\'ll work backwards to give you accurate week-by-week guidance.',
    ivf_transfer: 'For IVF pregnancies we calculate differently. Enter the transfer date and we\'ll adjust your gestational age accordingly.',
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Segmented tabs */}
      <View style={sd.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[sd.tab, dateType === t.key && sd.tabActive]}
            onPress={() => {
              onDateTypeChange(t.key);
              if (t.key === 'ivf_transfer') onIVFChange(true);
              else if (isIVF && t.key !== 'ivf_transfer') onIVFChange(false);
            }}
          >
            <Text style={[sd.tabText, dateType === t.key && sd.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.heading}>{headings[dateType]}</Text>
      <Tooltip text={tooltips[dateType]} />

      <View style={{ marginTop: spacing.xl }}>
        <DateWheelPicker
          day={day} month={month} year={year}
          onDayChange={onDayChange}
          onMonthChange={onMonthChange}
          onYearChange={onYearChange}
        />
      </View>

      <View style={sd.summaryCard}>
        <Text style={sd.summaryLabel}>Selected date</Text>
        <Text style={sd.summaryDate}>
          {String(day).padStart(2, '0')} {MONTHS[month - 1]} {year}
        </Text>
      </View>
    </View>
  );
}

const sd = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.lavenderLight,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.surface, ...shadow.sm },
  tabText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  tabTextActive: { color: colors.rose, fontWeight: '700' },
  summaryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.lavenderLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 11, color: colors.lavenderDark, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  summaryDate: { fontSize: 18, fontWeight: '700', color: colors.textDeep },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 2 — About you
// ──────────────────────────────────────────────────────────────────────────────

interface StepAboutProps {
  isFirstPregnancy: boolean;
  onFirstChange: (v: boolean) => void;
  previousPregnancies: number;
  onPrevChange: (n: number) => void;
  age: string;
  onAgeChange: (v: string) => void;
  conditions: string[];
  onConditionToggle: (k: string) => void;
}

function StepAbout({
  isFirstPregnancy, onFirstChange,
  previousPregnancies, onPrevChange,
  age, onAgeChange,
  conditions, onConditionToggle,
}: StepAboutProps) {
  return (
    <View>
      <Text style={s.heading}>Tell us a little about you</Text>

      {/* First pregnancy toggle */}
      <Text style={s.label}>Is this your first pregnancy?</Text>
      <View style={sa.boolRow}>
        {[true, false].map((v) => (
          <Pressable
            key={String(v)}
            style={[sa.boolBtn, isFirstPregnancy === v && sa.boolBtnActive]}
            onPress={() => onFirstChange(v)}
          >
            <Text style={[sa.boolText, isFirstPregnancy === v && sa.boolTextActive]}>
              {v ? '✨ Yes, first time' : '👶 Been here before'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Previous pregnancies counter */}
      {!isFirstPregnancy && (
        <View style={sa.counterRow}>
          <Text style={s.label}>How many previous pregnancies?</Text>
          <View style={sa.counter}>
            <Pressable
              style={sa.counterBtn}
              onPress={() => onPrevChange(Math.max(1, previousPregnancies - 1))}
            >
              <Text style={sa.counterBtnText}>−</Text>
            </Pressable>
            <Text style={sa.counterVal}>{previousPregnancies}</Text>
            <Pressable
              style={sa.counterBtn}
              onPress={() => onPrevChange(Math.min(10, previousPregnancies + 1))}
            >
              <Text style={sa.counterBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Age */}
      <Text style={[s.label, { marginTop: spacing.md }]}>
        Your age <Text style={s.optional}>(optional, for personalisation)</Text>
      </Text>
      <View style={sa.ageInput}>
        <TextInput
          style={sa.ageField}
          value={age}
          onChangeText={(t) => onAgeChange(t.replace(/\D/g, '').slice(0, 2))}
          placeholder="e.g. 28"
          placeholderTextColor={colors.textLight}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={sa.ageUnit}>years</Text>
      </View>

      {/* Conditions */}
      <Text style={[s.label, { marginTop: spacing.lg }]}>
        Any health conditions we should know about?
      </Text>
      <View style={sa.chips}>
        {CONDITIONS.map((c) => {
          const active = conditions.includes(c.key);
          return (
            <Pressable
              key={c.key}
              style={[sa.chip, active && sa.chipActive]}
              onPress={() => onConditionToggle(c.key)}
            >
              <Text style={[sa.chipText, active && sa.chipTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const sa = StyleSheet.create({
  boolRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  boolBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  boolBtnActive: { borderColor: colors.rose, backgroundColor: colors.roseLight },
  boolText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  boolTextActive: { color: colors.roseDark },
  counterRow: { marginBottom: spacing.md },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { fontSize: 20, color: colors.lavenderDark, fontWeight: '700', lineHeight: 24 },
  counterVal: { fontSize: 22, fontWeight: '800', color: colors.textDeep, minWidth: 32, textAlign: 'center' },
  ageInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    marginTop: spacing.sm,
    gap: spacing.sm,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  ageField: { fontSize: 17, fontWeight: '600', color: colors.textDeep, flex: 1 },
  ageUnit: { fontSize: 14, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.rose, backgroundColor: colors.roseLight },
  chipText: { fontSize: 13, color: colors.textBody, fontWeight: '500' },
  chipTextActive: { color: colors.roseDark, fontWeight: '600' },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 3 — Goals
// ──────────────────────────────────────────────────────────────────────────────

interface StepGoalsProps {
  goals: string[];
  onToggle: (k: string) => void;
}

function StepGoals({ goals, onToggle }: StepGoalsProps) {
  return (
    <View>
      <Text style={s.heading}>What matters most to you?</Text>
      <Text style={s.subheading}>Pick up to 3 — we'll tailor your experience.</Text>
      {GOALS.map((g) => (
        <GoalCard
          key={g.key}
          emoji={g.emoji}
          title={g.title}
          desc={g.desc}
          selected={goals.includes(g.key)}
          onPress={() => {
            if (goals.includes(g.key)) {
              onToggle(g.key);
            } else if (goals.length < 3) {
              onToggle(g.key);
            }
          }}
        />
      ))}
      {goals.length === 3 && (
        <Text style={sg.maxNote}>✓ Great picks! You can always change these later.</Text>
      )}
    </View>
  );
}

const sg = StyleSheet.create({
  maxNote: {
    textAlign: 'center',
    color: colors.success,
    fontWeight: '600',
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 4 — Location & Language
// ──────────────────────────────────────────────────────────────────────────────

interface StepLocationProps {
  country: Country | null;
  onCountryPress: () => void;
  language: string;
  onLanguageChange: (l: string) => void;
}

function StepLocation({ country, onCountryPress, language, onLanguageChange }: StepLocationProps) {
  return (
    <View>
      <Text style={s.heading}>Where are you based?</Text>
      <Text style={s.subheading}>We'll tailor guidance to your country's health system.</Text>

      <Text style={s.label}>Country</Text>
      <Pressable style={sl.countrySelector} onPress={onCountryPress}>
        {country ? (
          <>
            <Text style={sl.countryFlag}>{country.flag}</Text>
            <Text style={sl.countryName}>{country.name}</Text>
          </>
        ) : (
          <Text style={sl.placeholder}>Tap to select your country</Text>
        )}
        <Text style={sl.chevron}>›</Text>
      </Pressable>

      <Text style={[s.label, { marginTop: spacing.lg }]}>Language</Text>
      <View style={sl.langRow}>
        {LANGUAGES.map((l) => (
          <Pressable
            key={l.code}
            style={[sl.langChip, language === l.code && sl.langChipActive]}
            onPress={() => onLanguageChange(l.code)}
          >
            <Text style={[sl.langText, language === l.code && sl.langTextActive]}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Privacy note */}
      <View style={sl.privacyCard}>
        <Text style={sl.privacyIcon}>🔒</Text>
        <Text style={sl.privacyText}>
          <Text style={{ fontWeight: '700' }}>We never sell your data. Ever.</Text>
          {'\n'}Your information is encrypted and used only to personalise your experience.
        </Text>
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadow.sm,
  },
  countryFlag: { fontSize: 24, marginRight: spacing.md },
  countryName: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textDeep },
  placeholder: { flex: 1, fontSize: 15, color: colors.textLight },
  chevron: { fontSize: 22, color: colors.textMuted },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  langChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  langChipActive: { borderColor: colors.lavender, backgroundColor: colors.lavenderLight },
  langText: { fontSize: 14, color: colors.textBody, fontWeight: '500' },
  langTextActive: { color: colors.lavenderDark, fontWeight: '700' },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.lavenderPale,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.lavenderLight,
  },
  privacyIcon: { fontSize: 20, marginTop: 2 },
  privacyText: { flex: 1, fontSize: 13, color: colors.textBody, lineHeight: 19 },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 5 — Notifications
// ──────────────────────────────────────────────────────────────────────────────

interface NotifPrefs {
  dailyTip: boolean;
  appointmentReminders: boolean;
  weeklyUpdate: boolean;
}

interface StepNotificationsProps {
  prefs: NotifPrefs;
  onChange: (key: keyof NotifPrefs, v: boolean) => void;
  onAllow: () => void;
  onSkip: () => void;
  requesting: boolean;
}

function StepNotifications({ prefs, onChange, onAllow, onSkip, requesting }: StepNotificationsProps) {
  return (
    <View>
      <Text style={s.heading}>Stay on track with{'\n'}gentle reminders</Text>
      <Text style={s.subheading}>You can change these at any time in Settings.</Text>

      <View style={{ marginTop: spacing.lg }}>
        <NotifRow
          emoji="💡"
          title="Daily tip"
          desc="A bite-sized pregnancy insight every morning"
          value={prefs.dailyTip}
          onChange={(v) => onChange('dailyTip', v)}
        />
        <NotifRow
          emoji="📅"
          title="Appointment reminders"
          desc="Gentle nudges before your check-ups"
          value={prefs.appointmentReminders}
          onChange={(v) => onChange('appointmentReminders', v)}
        />
        <NotifRow
          emoji="👶"
          title="Weekly baby update"
          desc="New week, new milestone — every 7 days"
          value={prefs.weeklyUpdate}
          onChange={(v) => onChange('weeklyUpdate', v)}
        />
      </View>

      <Pressable style={sn.allowBtn} onPress={onAllow} disabled={requesting}>
        {requesting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={sn.allowText}>Allow notifications</Text>}
      </Pressable>

      <Pressable style={sn.skipBtn} onPress={onSkip}>
        <Text style={sn.skipText}>Maybe later</Text>
      </Pressable>
    </View>
  );
}

const sn = StyleSheet.create({
  allowBtn: {
    backgroundColor: colors.rose,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadow.md,
  },
  allowText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  skipBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  skipText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
});

// ──────────────────────────────────────────────────────────────────────────────
// Personalising screen (step 6 / loading state)
// ──────────────────────────────────────────────────────────────────────────────

function PersonalisingScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (error) return;
    const rotAnim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2000, useNativeDriver: true })
    );
    const dotAnim = Animated.loop(
      Animated.stagger(220, [
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ])
    );
    rotAnim.start();
    dotAnim.start();
    return () => { rotAnim.stop(); dotAnim.stop(); };
  }, [error]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (error) {
    return (
      <View style={ps.root}>
        <Text style={ps.errorEmoji}>😔</Text>
        <Text style={ps.errorTitle}>Something went wrong</Text>
        <Text style={ps.errorMsg}>{error}</Text>
        <Pressable style={ps.retryBtn} onPress={onRetry}>
          <Text style={ps.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={ps.root}>
      <View style={ps.blobTL} />
      <View style={ps.blobBR} />

      <Animated.View style={[ps.logoRing, { transform: [{ rotate }] }]}>
        <Text style={ps.logoEmoji}>🌸</Text>
      </Animated.View>

      <Text style={ps.title}>Personalising your{'\n'}experience…</Text>

      <View style={ps.dots}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[ps.dot, { opacity: d }]} />
        ))}
      </View>

      <Text style={ps.subtitle}>Bloom is calculating your week, your due date, and{'\n'}building your personal pregnancy profile.</Text>
    </View>
  );
}

const ps = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  blobTL: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: colors.lavenderLight, top: -60, left: -60, opacity: 0.6,
  },
  blobBR: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.roseLight, bottom: 80, right: -50, opacity: 0.7,
  },
  logoRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: colors.rose,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoEmoji: { fontSize: 48 },
  title: {
    fontSize: 26, fontWeight: '800', color: colors.textDeep,
    textAlign: 'center', lineHeight: 34, marginBottom: spacing.lg,
  },
  dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.rose,
  },
  subtitle: {
    fontSize: 14, color: colors.textBody, textAlign: 'center',
    lineHeight: 21, maxWidth: 280,
  },
  errorEmoji: { fontSize: 48, marginBottom: spacing.md },
  errorTitle: { fontSize: 22, fontWeight: '700', color: colors.textDeep, marginBottom: spacing.sm },
  errorMsg: { fontSize: 14, color: colors.textBody, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
  retryBtn: {
    backgroundColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
  },
  retryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

// ─── Shared step styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textDeep,
    lineHeight: 32,
    marginBottom: spacing.sm,
  },
  subheading: {
    fontSize: 15,
    color: colors.textBody,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textBody,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optional: {
    fontWeight: '400',
    fontSize: 12,
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.textMuted,
  },
});

// ─── Step metadata ─────────────────────────────────────────────────────────────

const STEP_TITLES = ['', 'Your dates', 'About you', 'Your goals', 'Location', 'Reminders'];
const STEP_SUBTITLES = [
  '',
  '2 min · helps us calculate your week',
  '1 min · shapes your content',
  '30 sec · max 3 picks',
  '30 sec · for local guidance',
  'Optional · change anytime',
];

// ─── Main OnboardingScreen ─────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router     = useRouter();
  const dispatch   = useAppDispatch();
  const profStatus = useAppSelector((st) => st.profile.status);

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // Step 1 — Date
  const today = new Date();
  // Default LMP to ~8 weeks ago
  const defaultLMP = new Date(today.getTime() - 56 * 86_400_000);
  const [dateType, setDateType]   = useState<DateType>('lmp');
  const [day,   setDay]           = useState(defaultLMP.getDate());
  const [month, setMonth]         = useState(defaultLMP.getMonth() + 1);
  const [year,  setYear]          = useState(defaultLMP.getFullYear());
  const [isIVF, setIsIVF]         = useState(false);

  // Step 2 — About
  const [isFirstPreg, setIsFirstPreg]      = useState(true);
  const [prevPregnancies, setPrevPregnancies] = useState(1);
  const [age,   setAge]                    = useState('');
  const [conditions, setConditions]        = useState<string[]>(['none']);

  // Step 3 — Goals
  const [goals, setGoals] = useState<string[]>([]);

  // Step 4 — Location
  const [country, setCountry]     = useState<Country | null>(null);
  const [language, setLanguage]   = useState(detectLanguageCode);
  const [countryModal, setCountryModal] = useState(false);

  // Step 5 — Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    dailyTip:             true,
    appointmentReminders: true,
    weeklyUpdate:         true,
  });
  const [requestingNotif, setRequestingNotif] = useState(false);

  // Personalising
  const [personalising, setPersonalising] = useState(false);
  const [apiError, setApiError]           = useState<string | null>(null);

  // ── Animation ───────────────────────────────────────────────────────────────
  const slideX  = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateToStep = useCallback((next: number) => {
    const dir = next > step ? 1 : -1;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: -dir * 40, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideX.setValue(dir * 40);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideX,  { toValue: 0, tension: 90, friction: 10, useNativeDriver: true }),
      ]).start();
    });
  }, [step, opacity, slideX]);

  // ── Validation per step ─────────────────────────────────────────────────────
  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return day > 0 && month > 0 && year > 0;
      case 3: return goals.length > 0;
      case 4: return country !== null;
      default: return true;
    }
  }, [step, day, month, year, goals, country]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const toggleCondition = (key: string) => {
    setConditions((prev) => {
      if (key === 'none') return ['none'];
      const without = prev.filter((c) => c !== 'none');
      return without.includes(key) ? without.filter((c) => c !== key) : [...without, key];
    });
  };

  const toggleGoal = (key: string) => {
    setGoals((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
  };

  const handleNotifAllow = async () => {
    setRequestingNotif(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied — still allow them to continue
      }
    } catch (_) { /* ignore */ }
    setRequestingNotif(false);
    callOnboardingAPI();
  };

  const callOnboardingAPI = async () => {
    setPersonalising(true);
    setApiError(null);
    setStep(6); // show personalising screen immediately

    const dateStr = formatDateFromParts(day, month, year);
    const answers = {
      dateType,
      lmpDate:          dateType === 'lmp'          ? dateStr : undefined,
      dueDate:          dateType === 'due_date'      ? dateStr : undefined,
      ivfTransferDate:  dateType === 'ivf_transfer'  ? dateStr : undefined,
      isIVF:            isIVF || dateType === 'ivf_transfer',
      isMultiples:      conditions.includes('multiples'),
      isFirstPregnancy: isFirstPreg,
      previousPregnancies: isFirstPreg ? 0 : prevPregnancies,
      age: age ? parseInt(age, 10) : undefined,
      healthConditions: conditions.filter((c) => c !== 'none'),
      goals,
      country:          country?.code ?? '',
      language,
      notifPrefs,
    };

    try {
      await dispatch(submitOnboarding(answers)).unwrap();
      router.replace('/(tabs)');
    } catch (err: any) {
      setApiError(
        err?.message ?? 'We couldn\'t personalise your profile. Please try again.'
      );
      setPersonalising(false);
    }
  };

  // ── Render logic ─────────────────────────────────────────────────────────────
  if (step === 6) {
    return (
      <PersonalisingScreen
        error={apiError}
        onRetry={() => { setStep(5); setPersonalising(false); }}
      />
    );
  }

  const showNavBar = step >= 1 && step <= 5;
  const isLastContentStep = step === 5;
  const notifStep = step === 5;

  return (
    <KeyboardAvoidingView
      style={main.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={main.container}>

        {/* Progress bar */}
        <View style={main.topBar}>
          {step > 0 && (
            <Pressable onPress={() => animateToStep(step - 1)} style={main.backBtn}>
              <Text style={main.backArrow}>‹</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <ProgressBar step={step} />
          </View>
          <Text style={main.stepCount}>
            {step > 0 ? `${step} / ${TOTAL_STEPS - 1}` : ''}
          </Text>
        </View>

        {/* Step header (steps 1–5) */}
        {step > 0 && step < 6 && (
          <View style={main.stepHeader}>
            <Text style={main.stepTitle}>{STEP_TITLES[step]}</Text>
            <Text style={main.stepSub}>{STEP_SUBTITLES[step]}</Text>
          </View>
        )}

        {/* Step content */}
        <Animated.View
          style={[
            main.stepContent,
            { opacity, transform: [{ translateX: slideX }] },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={main.scroll}
          >
            {step === 0 && (
              <StepWelcome
                onStart={() => animateToStep(1)}
                onSignIn={() => router.replace('/(auth)')}
              />
            )}
            {step === 1 && (
              <StepDate
                dateType={dateType} onDateTypeChange={setDateType}
                day={day} month={month} year={year}
                onDayChange={setDay} onMonthChange={setMonth} onYearChange={setYear}
                isIVF={isIVF} onIVFChange={setIsIVF}
              />
            )}
            {step === 2 && (
              <StepAbout
                isFirstPregnancy={isFirstPreg} onFirstChange={setIsFirstPreg}
                previousPregnancies={prevPregnancies} onPrevChange={setPrevPregnancies}
                age={age} onAgeChange={setAge}
                conditions={conditions} onConditionToggle={toggleCondition}
              />
            )}
            {step === 3 && (
              <StepGoals goals={goals} onToggle={toggleGoal} />
            )}
            {step === 4 && (
              <StepLocation
                country={country} onCountryPress={() => setCountryModal(true)}
                language={language} onLanguageChange={setLanguage}
              />
            )}
            {step === 5 && (
              <StepNotifications
                prefs={notifPrefs}
                onChange={(k, v) => setNotifPrefs((p) => ({ ...p, [k]: v }))}
                onAllow={handleNotifAllow}
                onSkip={callOnboardingAPI}
                requesting={requestingNotif}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* Bottom nav — only show for steps 1–4 (step 5 has its own buttons) */}
        {showNavBar && !isLastContentStep && (
          <View style={main.navBar}>
            <Pressable
              style={[main.nextBtn, !canAdvance && main.nextBtnDisabled]}
              onPress={() => canAdvance && animateToStep(step + 1)}
              disabled={!canAdvance}
            >
              <Text style={main.nextBtnText}>Continue</Text>
              <Text style={main.nextArrow}> →</Text>
            </Pressable>

            {step === 2 && (
              <Pressable style={main.skipLink} onPress={() => animateToStep(step + 1)}>
                <Text style={main.skipLinkText}>Skip for now</Text>
              </Pressable>
            )}
          </View>
        )}

      </View>

      {/* Country picker modal */}
      <CountryPickerModal
        visible={countryModal}
        selected={country?.code ?? ''}
        onSelect={(c) => setCountry(c)}
        onClose={() => setCountryModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const main = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    ...shadow.sm,
  },
  backArrow: { fontSize: 22, color: colors.textBody, lineHeight: 26 },
  stepCount: { fontSize: 12, color: colors.textMuted, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  stepHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  stepTitle: { fontSize: 13, fontWeight: '700', color: colors.rose, textTransform: 'uppercase', letterSpacing: 1 },
  stepSub:   { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stepContent: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  navBar: {
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.xs,
  },
  nextBtn: {
    backgroundColor: colors.rose,
    borderRadius: radius.pill,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  nextBtnDisabled: { backgroundColor: colors.roseMid, opacity: 0.5 },
  nextBtnText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  nextArrow:  { color: colors.white, fontSize: 17, fontWeight: '700' },
  skipLink:    { alignItems: 'center', paddingVertical: spacing.sm },
  skipLinkText: { color: colors.textMuted, fontSize: 14 },
});
