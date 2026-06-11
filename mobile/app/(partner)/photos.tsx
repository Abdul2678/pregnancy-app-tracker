// app/(partner)/photos.tsx
// Photo memories placeholder (expo-image-picker not installed).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function PartnerPhotos() {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Photo Memories</Text>
        <Text style={styles.subtitle}>A shared space for your journey together</Text>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={styles.emptyTitle}>Coming Soon</Text>
          <Text style={styles.emptyText}>
            Capture and share your pregnancy milestones — bump photos, ultrasound scans,
            and precious moments — all in one place.
          </Text>
        </View>

        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>What's coming</Text>
          {[
            '📅  Monthly bump progression timeline',
            '🖼️  Ultrasound scan gallery',
            '🤝  Both of you can add photos',
            '💌  Add notes and memories to each photo',
          ].map((f) => (
            <Text key={f} style={styles.featureItem}>{f}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#FDF0F8' },
  content:      { flex: 1, padding: 20, paddingTop: 60 },
  title:        { fontSize: 28, fontWeight: '800', color: '#3D1440', marginBottom: 4 },
  subtitle:     { fontSize: 14, color: '#A8997F', marginBottom: 32 },

  emptyCard:    {
    backgroundColor: '#FFFDF9', borderRadius: 24, padding: 32,
    alignItems: 'center', marginBottom: 20,
  },
  emptyEmoji:   { fontSize: 56, marginBottom: 16 },
  emptyTitle:   { fontSize: 22, fontWeight: '800', color: '#3D1440', marginBottom: 12 },
  emptyText:    { fontSize: 14, color: '#5A4636', textAlign: 'center', lineHeight: 22 },

  featuresCard: { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18 },
  featuresTitle: { fontSize: 14, fontWeight: '700', color: '#3D1440', marginBottom: 14 },
  featureItem:   { fontSize: 14, color: '#5A4636', marginBottom: 10, lineHeight: 20 },
});
