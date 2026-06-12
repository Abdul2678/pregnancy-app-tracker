// components/SoftPaywall.tsx
// Soft paywall modal — shown when free user hits AI message limit.
// Non-blocking: user can dismiss and still use other free features.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Analytics } from '../lib/analytics';

const { height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  reason?: 'ai_limit' | 'premium_feature';
  feature?: string;
}

const COPY = {
  ai_limit: {
    emoji: '💬',
    title: "You've used today's 10 free messages",
    body:  "With Bloom Premium, chat with your AI companion as much as you need — any hour of the day or night.",
    cta:   'Unlock unlimited chat',
  },
  premium_feature: {
    emoji: '🌸',
    title: 'This is a Premium feature',
    body:  'Upgrade to Bloom Premium to access the full timeline, health insights, birth plan builder, and more.',
    cta:   'See all Premium features',
  },
};

export default function SoftPaywall({ visible, onClose, reason = 'ai_limit', feature }: Props) {
  const router   = useRouter();
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      if (reason === 'ai_limit') Analytics.aiLimitReached();
      else if (feature) Analytics.premiumGateTapped(feature);
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const copy = COPY[reason];

  const onUpgrade = () => {
    onClose();
    router.push({
      pathname: '/features/paywall',
      params: { source: reason, feature: feature ?? reason },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />

        <Text style={s.emoji}>{copy.emoji}</Text>
        <Text style={s.title}>{copy.title}</Text>
        <Text style={s.body}>{copy.body}</Text>

        {/* Social proof row */}
        <View style={s.proofRow}>
          {['🤰', '🤱', '👶'].map((e, i) => (
            <View key={i} style={[s.proofAvatar, i > 0 && { marginLeft: -8 }]}>
              <Text style={s.proofAvatarEmoji}>{e}</Text>
            </View>
          ))}
          <Text style={s.proofText}>  50,000+ mums trust Bloom</Text>
        </View>

        {/* Features list */}
        {['Unlimited AI messages', 'Full timeline & insights', 'Postpartum & newborn tracker', 'Birth plan builder'].map((f) => (
          <View key={f} style={s.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color="#CC6E9A" />
            <Text style={s.featureText}>{f}</Text>
          </View>
        ))}

        <TouchableOpacity style={s.ctaBtn} onPress={onUpgrade} activeOpacity={0.88}>
          <Text style={s.ctaText}>{copy.cta}</Text>
        </TouchableOpacity>

        <View style={s.priceRow}>
          <Text style={s.priceText}>From $3.33/mo · 7-day free trial · Cancel anytime</Text>
        </View>

        <TouchableOpacity style={s.dismissBtn} onPress={onClose}>
          <Text style={s.dismissText}>Maybe later</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && <View style={{ height: 24 }} />}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61, 20, 64, 0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FDF0F8',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 16,
    alignItems: 'center',
  },
  handle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD5C4', marginBottom: 20 },

  emoji:   { fontSize: 44, marginBottom: 12 },
  title:   { fontSize: 20, fontWeight: '900', color: '#3D1440', textAlign: 'center', marginBottom: 8 },
  body:    { fontSize: 14, color: '#5A4636', textAlign: 'center', lineHeight: 21, marginBottom: 18, maxWidth: 300 },

  proofRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  proofAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F9E4F0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FDF0F8' },
  proofAvatarEmoji: { fontSize: 14 },
  proofText:   { fontSize: 12, color: '#8A7359', fontWeight: '600' },

  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 8 },
  featureText: { fontSize: 13, color: '#3D1440', fontWeight: '600' },

  ctaBtn:  { width: '100%', backgroundColor: '#CC6E9A', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 20, marginBottom: 4 },
  ctaText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },

  priceRow:    { marginBottom: 8 },
  priceText:   { fontSize: 11, color: '#A08070', textAlign: 'center' },

  dismissBtn:  { paddingVertical: 12 },
  dismissText: { color: '#8E72B8', fontSize: 13, fontWeight: '700' },
});
