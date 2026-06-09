// components/home/Skeleton.tsx
// Animated shimmer skeleton placeholders for the Home screen.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../constants/theme';

// ─── Base shimmer block ────────────────────────────────────────────────────────

interface ShimmerProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Shimmer({ width = '100%', height, borderRadius = radius.md, style }: ShimmerProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

// ─── Hero card skeleton ────────────────────────────────────────────────────────

export function HeroSkeleton() {
  return (
    <View style={sk.heroCard}>
      <View style={sk.heroLeft}>
        <Shimmer width={60} height={14} borderRadius={radius.sm} />
        <Shimmer width={100} height={44} borderRadius={radius.sm} style={{ marginTop: 8 }} />
        <Shimmer width={140} height={14} borderRadius={radius.sm} style={{ marginTop: 8 }} />
        <Shimmer width={120} height={12} borderRadius={radius.sm} style={{ marginTop: 6 }} />
      </View>
      <View style={sk.heroRight}>
        <Shimmer width={120} height={120} borderRadius={60} />
      </View>
    </View>
  );
}

// ─── Tip card skeleton ─────────────────────────────────────────────────────────

export function TipSkeleton() {
  return (
    <View style={sk.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Shimmer width={60} height={22} borderRadius={radius.pill} />
        <Shimmer width={30} height={22} borderRadius={radius.pill} style={{ marginLeft: 8 }} />
      </View>
      <Shimmer width="90%" height={16} />
      <Shimmer width="70%" height={14} style={{ marginTop: 6 }} />
      <Shimmer width="80%" height={14} style={{ marginTop: 6 }} />
    </View>
  );
}

// ─── Quick log row skeleton ────────────────────────────────────────────────────

export function QuickLogSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md }}>
      {[80, 70, 80, 60, 70].map((w, i) => (
        <Shimmer key={i} width={w} height={36} borderRadius={radius.pill} />
      ))}
    </View>
  );
}

// ─── Development teaser skeleton ──────────────────────────────────────────────

export function DevelopmentSkeleton() {
  return (
    <View style={sk.card}>
      <Shimmer width={120} height={14} />
      <Shimmer width="100%" height={16} style={{ marginTop: 10 }} />
      <Shimmer width="85%" height={16} style={{ marginTop: 6 }} />
      <Shimmer width="60%" height={14} style={{ marginTop: 10 }} />
    </View>
  );
}

// ─── Upcoming card skeleton ────────────────────────────────────────────────────

export function UpcomingSkeleton() {
  return (
    <View style={sk.card}>
      <Shimmer width={100} height={14} style={{ marginBottom: 12 }} />
      {[0, 1].map((i) => (
        <View key={i} style={[sk.upcomingRow, i > 0 && { marginTop: 12 }]}>
          <Shimmer width={44} height={44} borderRadius={radius.md} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Shimmer width="60%" height={14} />
            <Shimmer width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Community card skeleton ───────────────────────────────────────────────────

export function CommunitySkeleton() {
  return (
    <View style={sk.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Shimmer width={32} height={32} borderRadius={16} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Shimmer width="40%" height={12} />
        </View>
        <Shimmer width={50} height={12} />
      </View>
      <Shimmer width="90%" height={15} />
      <Shimmer width="75%" height={15} style={{ marginTop: 6 }} />
      <Shimmer width={100} height={14} style={{ marginTop: 12 }} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: { flex: 1, marginRight: spacing.md },
  heroRight: { alignItems: 'center' },
  upcomingRow: { flexDirection: 'row', alignItems: 'center' },
});
