// components/PremiumGate.tsx
// Wraps any premium feature with a blurred overlay + lock icon + upgrade prompt.
// Usage:
//   <PremiumGate feature="health_insights" locked={!isPremium}>
//     <HealthInsightsChart />
//   </PremiumGate>

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppSelector } from '../store';
import { selectIsPremium } from '../store/subscriptionSlice';
import { Analytics } from '../lib/analytics';

interface Props {
  feature: string;             // analytics identifier
  locked?: boolean;            // override — if omitted, derives from redux
  source?: string;             // paywall source label
  label?: string;              // custom CTA label
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function PremiumGate({
  feature,
  locked,
  source,
  label,
  children,
  style,
}: Props) {
  const router      = useRouter();
  const isPremium   = useAppSelector(selectIsPremium);
  const isLocked    = locked !== undefined ? locked : !isPremium;

  if (!isLocked) return <>{children}</>;

  const onUpgrade = () => {
    Analytics.premiumGateTapped(feature);
    router.push({ pathname: '/features/paywall', params: { source: source ?? feature, feature } });
  };

  return (
    <View style={[s.container, style]}>
      {/* Render children behind the gate (preview) */}
      <View style={s.preview} pointerEvents="none">
        {children}
      </View>

      {/* Frosted overlay */}
      <View style={[StyleSheet.absoluteFill, s.overlay]} />

      {/* Lock card */}
      <View style={s.lockCard}>
        <View style={s.lockIcon}>
          <Ionicons name="lock-closed" size={28} color="#CC6E9A" />
        </View>
        <Text style={s.lockTitle}>Premium feature</Text>
        <Text style={s.lockSub}>
          {label ?? 'Unlock unlimited AI, full timeline, health insights and more.'}
        </Text>
        <TouchableOpacity style={s.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
          <Text style={s.upgradeText}>Upgrade to Bloom Premium</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden', borderRadius: 16 },
  preview:   { opacity: 0.35 },
  overlay:   { backgroundColor: 'rgba(253, 240, 248, 0.82)' },

  lockCard:  {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  lockIcon:  {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFF0F6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  lockTitle: { fontSize: 17, fontWeight: '900', color: '#3D1440', marginBottom: 6 },
  lockSub:   { fontSize: 13, color: '#5A4636', textAlign: 'center', lineHeight: 19, marginBottom: 18, maxWidth: 260 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#CC6E9A', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 22,
  },
  upgradeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
