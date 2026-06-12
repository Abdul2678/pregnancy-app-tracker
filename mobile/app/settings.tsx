// app/settings.tsx
// Full settings screen: language, units, country, timezone, date format, notifications.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../store';
import { saveSettings } from '../store/settingsSlice';
import { restorePurchases } from '../store/subscriptionSlice';
import { SUPPORTED_LANGUAGES, t } from '../lib/i18n';
import type { UnitSystem, DateFormat } from '../lib/units';

// ── Constants ──────────────────────────────────────────────────────────────

const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'DMY', label: 'DD/MM/YYYY', example: '25/12/2024' },
  { value: 'MDY', label: 'MM/DD/YYYY', example: '12/25/2024' },
  { value: 'YMD', label: 'YYYY-MM-DD', example: '2024-12-25' },
];

const POPULAR_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Jakarta',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Istanbul',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: 'PK', name: 'Pakistan',       flag: '🇵🇰' },
  { code: 'IN', name: 'India',          flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷' },
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬' },
  { code: 'TR', name: 'Turkey',         flag: '🇹🇷' },
  { code: 'ID', name: 'Indonesia',      flag: '🇮🇩' },
  { code: 'EG', name: 'Egypt',          flag: '🇪🇬' },
  { code: 'SA', name: 'Saudi Arabia',   flag: '🇸🇦' },
  { code: 'KE', name: 'Kenya',          flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦' },
  { code: 'MX', name: 'Mexico',         flag: '🇲🇽' },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪' },
  { code: 'FR', name: 'France',         flag: '🇫🇷' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦' },
  { code: 'PH', name: 'Philippines',    flag: '🇵🇭' },
  { code: 'BD', name: 'Bangladesh',     flag: '🇧🇩' },
  { code: 'GH', name: 'Ghana',          flag: '🇬🇭' },
  { code: 'ET', name: 'Ethiopia',       flag: '🇪🇹' },
  { code: 'TZ', name: 'Tanzania',       flag: '🇹🇿' },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function OptionRow({
  label, sub, selected, onPress,
}: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.optionInfo}>
        <Text style={styles.optionLabel}>{label}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
      {selected && <Ionicons name="checkmark" size={20} color="#CC6E9A" />}
    </TouchableOpacity>
  );
}

function ToggleRow({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#DDD5C4', true: '#CC6E9A' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

type Section = 'language' | 'units' | 'country' | 'timezone' | 'dateFormat' | null;

export default function Settings() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const saved    = useAppSelector((s) => s.settings);

  const [language,   setLanguage]   = useState(saved.language);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(saved.unitSystem);
  const [dateFormat, setDateFormat] = useState<DateFormat>(saved.dateFormat);
  const [timezone,   setTimezone]   = useState(saved.timezone);
  const [country,    setCountry]    = useState(saved.country);
  const [section,    setSection]    = useState<Section>(null);
  const [saving,     setSaving]     = useState(false);
  const [savedMsg,   setSavedMsg]   = useState(false);

  const { tier, restoring } = useAppSelector((s) => s.subscription);
  const onRestore = useCallback(async () => {
    // IAP restore stub — real implementation needs react-native-iap
    Alert.alert('Restore purchases', 'No active subscription found for this account. If you have an active subscription, make sure you are signed in with the same Apple ID or Google account.', [{ text: 'OK' }]);
  }, []);

  const isDirty =
    language   !== saved.language   ||
    unitSystem !== saved.unitSystem ||
    dateFormat !== saved.dateFormat ||
    timezone   !== saved.timezone   ||
    country    !== saved.country;

  const onSave = useCallback(async () => {
    setSaving(true);
    const patch = { language, unitSystem, dateFormat, timezone, country };
    await dispatch(saveSettings(patch));
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);

    const langChanged = language !== saved.language;
    if (langChanged) {
      Alert.alert(
        'Language changed',
        t('settings.restartRequired'),
        [{ text: 'OK' }]
      );
    }
  }, [language, unitSystem, dateFormat, timezone, country, dispatch, saved.language]);

  const currentLang    = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const currentCountry = COUNTRIES.find((c) => c.code === country);
  const currentFmt     = DATE_FORMATS.find((f) => f.value === dateFormat);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        {saving
          ? <ActivityIndicator color="#CC6E9A" />
          : savedMsg
            ? <Text style={styles.savedMsg}>✓ Saved</Text>
            : isDirty
              ? <TouchableOpacity onPress={onSave} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                </TouchableOpacity>
              : <View style={{ width: 52 }} />
        }
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── Language ── */}
        <SectionHeader title={t('settings.language')} />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.summaryRow}
            onPress={() => setSection(section === 'language' ? null : 'language')}
            activeOpacity={0.8}
          >
            <Text style={styles.summaryLabel}>{t('settings.language')}</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryValue}>{currentLang?.flag} {currentLang?.nativeName}</Text>
              <Ionicons
                name={section === 'language' ? 'chevron-up' : 'chevron-down'}
                size={16} color="#A8997F"
              />
            </View>
          </TouchableOpacity>

          {section === 'language' && SUPPORTED_LANGUAGES.map((lang) => (
            <OptionRow
              key={lang.code}
              label={`${lang.flag}  ${lang.nativeName}`}
              sub={lang.name}
              selected={language === lang.code}
              onPress={() => setLanguage(lang.code)}
            />
          ))}
        </View>

        {/* ── Units ── */}
        <SectionHeader title={t('settings.units')} />
        <View style={styles.card}>
          <OptionRow
            label="🌍  Metric"
            sub="kg · cm · °C"
            selected={unitSystem === 'metric'}
            onPress={() => setUnitSystem('metric')}
          />
          <OptionRow
            label="🇺🇸  Imperial"
            sub="lbs · in · °F"
            selected={unitSystem === 'imperial'}
            onPress={() => setUnitSystem('imperial')}
          />
        </View>

        {/* ── Date Format ── */}
        <SectionHeader title={t('settings.dateFormat')} />
        <View style={styles.card}>
          {DATE_FORMATS.map((fmt) => (
            <OptionRow
              key={fmt.value}
              label={fmt.label}
              sub={fmt.example}
              selected={dateFormat === fmt.value}
              onPress={() => setDateFormat(fmt.value)}
            />
          ))}
        </View>

        {/* ── Country ── */}
        <SectionHeader title={t('settings.country')} />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.summaryRow}
            onPress={() => setSection(section === 'country' ? null : 'country')}
            activeOpacity={0.8}
          >
            <Text style={styles.summaryLabel}>{t('settings.country')}</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryValue}>
                {currentCountry ? `${currentCountry.flag} ${currentCountry.name}` : country}
              </Text>
              <Ionicons
                name={section === 'country' ? 'chevron-up' : 'chevron-down'}
                size={16} color="#A8997F"
              />
            </View>
          </TouchableOpacity>

          {section === 'country' && COUNTRIES.map((c) => (
            <OptionRow
              key={c.code}
              label={`${c.flag}  ${c.name}`}
              selected={country === c.code}
              onPress={() => setCountry(c.code)}
            />
          ))}
        </View>

        {/* ── Time Zone ── */}
        <SectionHeader title={t('settings.timezone')} />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.summaryRow}
            onPress={() => setSection(section === 'timezone' ? null : 'timezone')}
            activeOpacity={0.8}
          >
            <Text style={styles.summaryLabel}>{t('settings.timezone')}</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryValue}>{timezone}</Text>
              <Ionicons
                name={section === 'timezone' ? 'chevron-up' : 'chevron-down'}
                size={16} color="#A8997F"
              />
            </View>
          </TouchableOpacity>

          {section === 'timezone' && POPULAR_TIMEZONES.map((tz) => (
            <OptionRow
              key={tz}
              label={tz.replace('_', ' ')}
              selected={timezone === tz}
              onPress={() => setTimezone(tz)}
            />
          ))}
        </View>

        {/* ── Privacy (prominent, first) ── */}
        <SectionHeader title="Privacy" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.aboutRow} onPress={() => router.push('/privacy')}>
            <Ionicons name="lock-closed-outline" size={18} color="#CC6E9A" />
            <Text style={[styles.aboutLabel, { fontWeight: '700' }]}>Your data belongs to you</Text>
            <Ionicons name="chevron-forward" size={16} color="#C8B8A2" />
          </TouchableOpacity>
        </View>

        {/* ── Notifications ── */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.aboutRow} onPress={() => router.push('/notification-settings')}>
            <Ionicons name="notifications-outline" size={18} color="#A8997F" />
            <Text style={styles.aboutLabel}>Notification preferences</Text>
            <Ionicons name="chevron-forward" size={16} color="#C8B8A2" />
          </TouchableOpacity>
        </View>

        {/* ── Subscription ── */}
        <SectionHeader title="Subscription" />
        <View style={styles.card}>
          <View style={styles.subRow}>
            <View style={[styles.subBadge, tier === 'premium' && styles.subBadgePremium]}>
              <Text style={[styles.subBadgeText, tier === 'premium' && styles.subBadgeTextPremium]}>
                {tier === 'premium' ? '🌸 Bloom Premium' : '🆓 Free Plan'}
              </Text>
            </View>
          </View>
          {tier !== 'premium' && (
            <TouchableOpacity style={styles.upgradeRow} onPress={() => router.push('/features/paywall')}>
              <Ionicons name="sparkles" size={16} color="#CC6E9A" />
              <Text style={styles.upgradeRowText}>Upgrade to Bloom Premium</Text>
              <Ionicons name="chevron-forward" size={14} color="#CC6E9A" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.aboutRow} onPress={onRestore} disabled={restoring}>
            <Ionicons name="refresh-outline" size={18} color="#A8997F" />
            <Text style={styles.aboutLabel}>Restore purchases</Text>
            {restoring && <ActivityIndicator size="small" color="#CC6E9A" />}
          </TouchableOpacity>
        </View>

        {/* ── About ── */}
        <SectionHeader title={t('settings.aboutApp')} />
        <View style={styles.card}>
          {[
            { label: t('settings.privacyPolicy'),  icon: 'shield-checkmark-outline' as const },
            { label: t('settings.termsOfService'), icon: 'document-text-outline' as const },
          ].map(({ label, icon }) => (
            <TouchableOpacity
              key={label}
              style={styles.aboutRow}
              activeOpacity={0.7}
              onPress={() => { if (icon === 'shield-checkmark-outline') router.push('/privacy-policy'); }}
            >
              <Ionicons name={icon} size={18} color="#A8997F" />
              <Text style={styles.aboutLabel}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#C8B8A2" />
            </TouchableOpacity>
          ))}
          <View style={styles.versionRow}>
            <Text style={styles.versionText}>Bloom v1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#FDF0F8' },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#FDF0F8',
  },
  backBtn:      { padding: 4 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: '#3D1440' },
  saveBtn:      { backgroundColor: '#CC6E9A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  saveBtnText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  savedMsg:     { color: '#4EA86A', fontWeight: '700', fontSize: 14 },
  subRow:       { padding: 14, paddingBottom: 8 },
  subBadge:     { alignSelf: 'flex-start', backgroundColor: '#F3F3F3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  subBadgePremium: { backgroundColor: '#F9E4F0' },
  subBadgeText: { fontSize: 13, fontWeight: '700', color: '#8A7359' },
  subBadgeTextPremium: { color: '#CC6E9A' },
  upgradeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, paddingTop: 4 },
  upgradeRowText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#CC6E9A' },

  scroll:       { flex: 1 },
  content:      { padding: 20 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#A8997F', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  card:         { backgroundColor: '#FFFDF9', borderRadius: 16, marginBottom: 20, overflow: 'hidden' },

  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: '#3D1440' },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryValue: { fontSize: 14, color: '#8A7359' },

  optionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F4EFE9' },
  optionInfo:   { flex: 1 },
  optionLabel:  { fontSize: 15, color: '#3D1440' },
  optionSub:    { fontSize: 12, color: '#A8997F', marginTop: 2 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#F4EFE9' },
  toggleInfo:   { flex: 1, paddingRight: 16 },
  toggleLabel:  { fontSize: 15, fontWeight: '600', color: '#3D1440' },

  aboutRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#F4EFE9' },
  aboutLabel:   { flex: 1, fontSize: 15, color: '#3D1440' },
  versionRow:   { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F4EFE9' },
  versionText:  { fontSize: 13, color: '#C8B8A2' },
});
