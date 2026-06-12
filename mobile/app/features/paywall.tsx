// app/features/paywall.tsx
// Hard paywall — shown when user taps a premium feature or hits the AI limit.
// Supports monthly / annual toggle, feature comparison table, social proof.
// IAP is handled via a thin wrapper so react-native-iap can be swapped in later.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import { validateReceipt } from '../../store/subscriptionSlice';
import { Analytics } from '../../lib/analytics';
import { PREMIUM_PRICING } from '../../lib/units';

const { width } = Dimensions.get('window');

// ── IAP Product IDs ───────────────────────────────────────────────────────────
// These must match what is configured in App Store Connect / Google Play Console.
export const PRODUCT_IDS = {
  monthly: Platform.OS === 'ios' ? 'bloom_premium_monthly' : 'bloom_premium_monthly_android',
  annual:  Platform.OS === 'ios' ? 'bloom_premium_annual'  : 'bloom_premium_annual_android',
};

// ── Pricing ───────────────────────────────────────────────────────────────────
const MONTHLY_PRICE = '$6.99';
const ANNUAL_PRICE  = '$39.99';
const ANNUAL_MONTHLY_EQUIV = '$3.33'; // per month when billed annually
const ANNUAL_SAVING_PCT = '52%';

// ── Feature comparison ────────────────────────────────────────────────────────
const FEATURES: { label: string; free: boolean | string; premium: boolean | string }[] = [
  { label: 'Weekly pregnancy updates',      free: true,         premium: true },
  { label: 'Symptom & mood tracking',       free: true,         premium: true },
  { label: 'Partner invite',                free: true,         premium: true },
  { label: 'AI pregnancy companion',        free: '10 / day',   premium: 'Unlimited' },
  { label: 'Full week-by-week timeline',    free: 'Current week only', premium: true },
  { label: 'Postpartum mode & newborn tracker', free: false,    premium: true },
  { label: 'Birth plan builder (AI)',       free: false,        premium: true },
  { label: 'Health insights & charts',      free: false,        premium: true },
  { label: 'PDF export for appointments',   free: false,        premium: true },
  { label: '6-week check-in AI summary',    free: false,        premium: true },
  { label: 'Offline access',               free: false,        premium: true },
  { label: 'Priority support',             free: false,        premium: true },
];

const REVIEWS = [
  { name: 'Sarah M.',   text: 'The AI companion answered every question my midwife didn\'t have time for. Worth every penny.' },
  { name: 'Priya K.',   text: 'I\'ve tried Flo and The Bump. Bloom is the only app that felt like it was made for me.' },
  { name: 'Charlotte W.', text: 'The partner invite is genius. My husband finally feels involved.' },
];

// ── Stub purchase (replace with react-native-iap) ────────────────────────────
async function triggerPurchase(productId: string): Promise<{ receipt: string } | null> {
  // TODO: Replace with:
  //   import { requestPurchase, getProducts } from 'react-native-iap';
  //   const purchase = await requestPurchase({ sku: productId });
  //   return { receipt: purchase.transactionReceipt };
  console.warn('IAP stub — install react-native-iap and replace this function');
  return null;
}

async function triggerRestore(): Promise<{ receipt: string } | null> {
  // TODO: Replace with:
  //   import { getAvailablePurchases } from 'react-native-iap';
  //   const purchases = await getAvailablePurchases();
  //   const latest = purchases[0];
  //   return latest ? { receipt: latest.transactionReceipt } : null;
  console.warn('IAP restore stub — install react-native-iap');
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Paywall() {
  const router    = useRouter();
  const dispatch  = useAppDispatch();
  const params    = useLocalSearchParams<{ source?: string; feature?: string }>();
  const { purchasing, validating } = useAppSelector((s) => s.subscription);

  const [plan, setPlan]       = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Analytics.paywallViewed(params.source ?? 'unknown');
    // Shimmer animation on the CTA badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  const onSubscribe = async () => {
    Analytics.paywallCtaTapped(plan);
    setLoading(true);
    try {
      const result = await triggerPurchase(PRODUCT_IDS[plan]);
      if (!result) {
        // IAP not configured yet (stub returned null)
        Alert.alert(
          'Coming soon',
          'In-app purchases will be available when the app is submitted to the App Store and Google Play. Your account will be upgraded automatically.',
        );
        return;
      }
      await dispatch(validateReceipt({
        receipt: result.receipt,
        platform: Platform.OS as 'ios' | 'android',
        productId: PRODUCT_IDS[plan],
      })).unwrap();
      Analytics.purchaseCompleted(plan, 'USD', plan === 'monthly' ? 6.99 : 39.99);
      Alert.alert('Welcome to Bloom Premium! 🌸', 'All features are now unlocked.', [
        { text: 'Explore', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Analytics.purchaseFailed(e?.message ?? 'unknown');
      Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRestore = async () => {
    setLoading(true);
    try {
      const result = await triggerRestore();
      if (!result) {
        Alert.alert('No purchases found', 'We could not find an active subscription for this account.');
        return;
      }
      await dispatch(validateReceipt({
        receipt: result.receipt,
        platform: Platform.OS as 'ios' | 'android',
        productId: PRODUCT_IDS[plan],
      })).unwrap();
      Analytics.purchaseRestored();
      Alert.alert('Restored!', 'Your premium subscription is active again.');
      router.back();
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || purchasing || validating;

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.navRow}>
        <TouchableOpacity onPress={() => { Analytics.paywallDismissed(params.source ?? 'unknown'); router.back(); }}>
          <Ionicons name="close" size={24} color="#3D1440" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🌸</Text>
          <Text style={s.heroTitle}>Bloom Premium</Text>
          <Text style={s.heroSub}>Everything you need for the most important 40 weeks of your life — and beyond.</Text>
        </View>

        {/* Plan toggle */}
        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, plan === 'monthly' && s.toggleActive]}
            onPress={() => setPlan('monthly')}
          >
            <Text style={[s.toggleLabel, plan === 'monthly' && s.toggleLabelActive]}>Monthly</Text>
            <Text style={[s.togglePrice, plan === 'monthly' && s.togglePriceActive]}>{MONTHLY_PRICE}/mo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.toggleBtn, plan === 'annual' && s.toggleActive]}
            onPress={() => setPlan('annual')}
          >
            <Animated.View style={[s.saveBadge, { opacity: shimmerOpacity }]}>
              <Text style={s.saveBadgeText}>Save {ANNUAL_SAVING_PCT}</Text>
            </Animated.View>
            <Text style={[s.toggleLabel, plan === 'annual' && s.toggleLabelActive]}>Annual</Text>
            <Text style={[s.togglePrice, plan === 'annual' && s.togglePriceActive]}>
              {ANNUAL_MONTHLY_EQUIV}/mo
            </Text>
            <Text style={[s.toggleSub, plan === 'annual' && s.toggleSubActive]}>
              Billed {ANNUAL_PRICE}/year
            </Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.ctaBtn} onPress={onSubscribe} disabled={busy} activeOpacity={0.88}>
          {busy
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.ctaText}>
                Start free 7-day trial · then {plan === 'monthly' ? MONTHLY_PRICE + '/mo' : ANNUAL_PRICE + '/yr'}
              </Text>}
        </TouchableOpacity>
        <Text style={s.ctaCaption}>Cancel anytime · No commitment · Secured by {Platform.OS === 'ios' ? 'Apple' : 'Google'}</Text>

        {/* Feature table */}
        <Text style={s.sectionTitle}>What's included</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <Text style={[s.tableCell, s.tableLabelHdr]}>Feature</Text>
            <Text style={[s.tableCell, s.tableTierHdr]}>Free</Text>
            <Text style={[s.tableCell, s.tableTierHdr, s.premiumHdr]}>Premium</Text>
          </View>
          {FEATURES.map((f, i) => (
            <View key={f.label} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
              <Text style={[s.tableCell, s.tableLabelCell]}>{f.label}</Text>
              <View style={[s.tableCell, s.tableIconCell]}>
                {f.free === true
                  ? <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  : f.free === false
                    ? <Ionicons name="close-circle" size={16} color="#DDD5C4" />
                    : <Text style={s.tableLimitText}>{f.free}</Text>}
              </View>
              <View style={[s.tableCell, s.tableIconCell]}>
                {f.premium === true
                  ? <Ionicons name="checkmark-circle" size={16} color="#CC6E9A" />
                  : <Text style={s.tablePremiumText}>{f.premium}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* Reviews */}
        <Text style={s.sectionTitle}>What mums say</Text>
        {REVIEWS.map((r) => (
          <View key={r.name} style={s.reviewCard}>
            <View style={s.stars}>
              {[1,2,3,4,5].map((i) => <Ionicons key={i} name="star" size={12} color="#F7B731" />)}
            </View>
            <Text style={s.reviewText}>"{r.text}"</Text>
            <Text style={s.reviewName}>— {r.name}</Text>
          </View>
        ))}

        {/* Restore */}
        <TouchableOpacity style={s.restoreBtn} onPress={onRestore} disabled={busy}>
          <Text style={s.restoreText}>Restore purchase</Text>
        </TouchableOpacity>

        <Text style={s.legal}>
          Payment will be charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account on confirmation.
          Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.
          Manage your subscription in {Platform.OS === 'ios' ? 'Settings > Apple ID > Subscriptions' : 'Google Play > Subscriptions'}.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#FDF0F8' },
  navRow:  { paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 8, alignItems: 'flex-end' },
  scroll:  { paddingBottom: 24 },

  hero:         { margin: 20, borderRadius: 24, alignItems: 'center', padding: 32, backgroundColor: '#F9E4F0' },
  heroEmoji:    { fontSize: 48, marginBottom: 10 },
  heroTitle:    { fontSize: 28, fontWeight: '900', color: '#3D1440', marginBottom: 8 },
  heroSub:      { fontSize: 14, color: '#5A4636', textAlign: 'center', lineHeight: 21, maxWidth: 280 },

  toggleRow:    { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginBottom: 20 },
  toggleBtn:    { flex: 1, borderRadius: 18, backgroundColor: '#FFFDF9', padding: 16, alignItems: 'center', position: 'relative', borderWidth: 2, borderColor: 'transparent' },
  toggleActive: { borderColor: '#CC6E9A', backgroundColor: '#FFF0F6' },
  toggleLabel:  { fontSize: 14, fontWeight: '800', color: '#8A7359', marginBottom: 4 },
  toggleLabelActive: { color: '#3D1440' },
  togglePrice:  { fontSize: 20, fontWeight: '900', color: '#8A7359' },
  togglePriceActive: { color: '#CC6E9A' },
  toggleSub:    { fontSize: 11, color: '#C8B8A2', marginTop: 2 },
  toggleSubActive: { color: '#8A7359' },
  saveBadge:    { position: 'absolute', top: -10, right: 8, backgroundColor: '#CC6E9A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  saveBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },

  ctaBtn:    { marginHorizontal: 20, backgroundColor: '#CC6E9A', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginBottom: 8 },
  ctaText:   { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  ctaCaption: { textAlign: 'center', fontSize: 11, color: '#A08070', marginBottom: 28 },

  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#3D1440', marginHorizontal: 20, marginBottom: 12 },

  table:       { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 28 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#FFFDF9' },
  tableRowAlt: { backgroundColor: '#FDF5FB' },
  tableHeader: { backgroundColor: '#F3E9F8', paddingVertical: 12 },
  tableCell:   { flex: 1 },
  tableLabelHdr:   { fontSize: 11, fontWeight: '800', color: '#5A4636' },
  tableTierHdr:    { fontSize: 11, fontWeight: '800', color: '#8A7359', textAlign: 'center' },
  premiumHdr:      { color: '#CC6E9A' },
  tableLabelCell:  { fontSize: 12, color: '#3D1440', flex: 2, fontWeight: '600' },
  tableIconCell:   { alignItems: 'center', justifyContent: 'center' },
  tableLimitText:  { fontSize: 10, color: '#8A7359', textAlign: 'center', fontWeight: '600' },
  tablePremiumText: { fontSize: 10, color: '#CC6E9A', textAlign: 'center', fontWeight: '700' },

  reviewCard:  { marginHorizontal: 20, backgroundColor: '#FFFDF9', borderRadius: 16, padding: 16, marginBottom: 10 },
  stars:       { flexDirection: 'row', gap: 2, marginBottom: 8 },
  reviewText:  { fontSize: 13, color: '#5A4636', lineHeight: 19, marginBottom: 6, fontStyle: 'italic' },
  reviewName:  { fontSize: 11, fontWeight: '700', color: '#A08070' },

  restoreBtn:  { alignItems: 'center', paddingVertical: 14 },
  restoreText: { color: '#8E72B8', fontSize: 13, fontWeight: '700' },

  legal: { marginHorizontal: 20, fontSize: 10, color: '#C8B8A2', lineHeight: 15, textAlign: 'center', marginTop: 8 },
});
