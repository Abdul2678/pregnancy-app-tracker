// components/development/BabyIllustration.tsx
// Animated SVG fetal illustration with Reanimated breathing + gentle float.
// The baby scales proportionally to the current week (weeks 4-40).

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle, Ellipse, Path, G, Defs, RadialGradient, Stop, LinearGradient,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

// ─── Week→scale table (visual growth 4→40 weeks) ─────────────────────────────
function weekScale(week: number): number {
  // Maps week 4-40 to scale 0.45-1.0
  const w = Math.min(40, Math.max(4, week));
  return 0.45 + ((w - 4) / 36) * 0.55;
}

interface Props {
  week: number;
  size?: number;
}

export default function BabyIllustration({ week, size = 200 }: Props) {
  // Breathing: gentle scale 1.0 → 1.025 → 1.0
  const breathe = useSharedValue(0);
  // Floating: translateY 0 → -4 → 0
  const float = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    // Offset float slightly so it doesn't sync with breathe
    const timeout = setTimeout(() => {
      float.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, 600);
    return () => clearTimeout(timeout);
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(breathe.value, [0, 1], [1, 1.025]);
    const translateY = interpolate(float.value, [0, 1], [0, -5]);
    return { transform: [{ scale }, { translateY }] };
  });

  const babyScale = weekScale(week);
  const containerSize = size;
  // SVG is drawn at 200×200 internal units, centered
  const svgSize = 200;

  return (
    <View
      style={{
        width: containerSize,
        height: containerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AnimatedView style={animStyle}>
        <Svg
          width={containerSize * babyScale}
          height={containerSize * babyScale}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          <Defs>
            {/* Skin gradient */}
            <RadialGradient id="skin" cx="50%" cy="40%" r="55%">
              <Stop offset="0%" stopColor="#FFD6C8" />
              <Stop offset="100%" stopColor="#F0A898" />
            </RadialGradient>
            {/* Glow / backdrop circle */}
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FAEAF3" stopOpacity="1" />
              <Stop offset="100%" stopColor="#F8F2FF" stopOpacity="0.4" />
            </RadialGradient>
            {/* Body shadow */}
            <LinearGradient id="shadow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E09AB8" stopOpacity="0.0" />
              <Stop offset="100%" stopColor="#CC6E9A" stopOpacity="0.18" />
            </LinearGradient>
          </Defs>

          {/* Backdrop glow circle */}
          <Circle cx="100" cy="105" r="82" fill="url(#glow)" />

          {/* ── Baby body (curled fetal position) ── */}
          {/* Main torso — large curved shape curling left */}
          <Path
            d="M 100 155
               C 60 155, 38 138, 36 115
               C 34 92, 50 72, 68 62
               C 80 55, 90 50, 100 48
               C 118 48, 135 58, 142 72
               C 152 90, 150 118, 138 138
               C 128 153, 114 155, 100 155 Z"
            fill="url(#skin)"
          />
          {/* Shadow overlay on body */}
          <Path
            d="M 100 155
               C 60 155, 38 138, 36 115
               C 34 92, 50 72, 68 62
               C 80 55, 90 50, 100 48
               C 118 48, 135 58, 142 72
               C 152 90, 150 118, 138 138
               C 128 153, 114 155, 100 155 Z"
            fill="url(#shadow)"
          />

          {/* ── Head ── */}
          <Circle cx="78" cy="68" r="26" fill="url(#skin)" />
          {/* Hair wisps */}
          <Path
            d="M 68 44 Q 72 36 80 40 Q 76 32 84 36 Q 86 28 90 34"
            stroke="#F0A898"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Closed eye */}
          <Path
            d="M 70 65 Q 73 63 76 65"
            stroke="#D4806A"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          {/* Tiny nose */}
          <Path
            d="M 73 70 Q 75 72 77 70"
            stroke="#E09898"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Tiny mouth */}
          <Path
            d="M 71 75 Q 74 77 77 75"
            stroke="#D4806A"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Cheek blush */}
          <Ellipse cx="68" cy="72" rx="5" ry="3" fill="#FFB6C1" fillOpacity="0.45" />

          {/* ── Arm (foreground) — curled near face ── */}
          <Path
            d="M 96 90 C 90 78, 80 72, 76 82 C 72 90, 80 98, 88 96"
            stroke="#F0A898"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Little fist */}
          <Circle cx="88" cy="96" r="8" fill="url(#skin)" />

          {/* ── Knee / leg curled up ── */}
          <Ellipse
            cx="128"
            cy="108"
            rx="18"
            ry="16"
            fill="url(#skin)"
          />
          {/* Lower leg / foot */}
          <Path
            d="M 138 120 C 148 128, 150 140, 140 148 C 132 154, 120 148, 118 140"
            stroke="#F0A898"
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
          />
          {/* Tiny toes */}
          <Circle cx="136" cy="150" r="4" fill="url(#skin)" />
          <Circle cx="141" cy="148" r="3.5" fill="url(#skin)" />
          <Circle cx="145" cy="144" r="3" fill="url(#skin)" />

          {/* ── Umbilical cord ── */}
          <Path
            d="M 100 130 Q 108 142, 112 138"
            stroke="#CC6E9A"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="3 2"
            strokeOpacity="0.5"
          />

          {/* ── Floating sparkle dots (decorative) ── */}
          <Circle cx="38" cy="80"  r="3" fill="#CC6E9A" fillOpacity="0.3" />
          <Circle cx="160" cy="70" r="2" fill="#8E72B8" fillOpacity="0.3" />
          <Circle cx="155" cy="145" r="3.5" fill="#CC6E9A" fillOpacity="0.2" />
          <Circle cx="42" cy="140" r="2.5" fill="#8E72B8" fillOpacity="0.25" />
          <Circle cx="32"  cy="110" r="2" fill="#E09AB8" fillOpacity="0.4" />
          <Circle cx="168" cy="110" r="1.5" fill="#B09AD8" fillOpacity="0.4" />
        </Svg>
      </AnimatedView>
    </View>
  );
}
