// app/privacy-policy.tsx
// Plain-language privacy policy, fetched from the API (single source of truth).

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '../lib/api';

export default function PrivacyPolicy() {
  const router = useRouter();
  const [policy, setPolicy] = useState<string | null>(null);

  useEffect(() => {
    api.get('/privacy/policy')
      .then(({ data }) => setPolicy((data?.data ?? data).policy))
      .catch(() => setPolicy('Could not load the policy. Please try again.'));
  }, []);

  // Minimal markdown rendering: headers and bullets
  const renderLine = (line: string, i: number) => {
    if (line.startsWith('# '))  return <Text key={i} style={s.h1}>{line.slice(2)}</Text>;
    if (line.startsWith('## ')) return <Text key={i} style={s.h2}>{line.slice(3)}</Text>;
    if (line.startsWith('- '))  return <Text key={i} style={s.bullet}>•  {line.slice(2).replace(/\*\*/g, '')}</Text>;
    if (!line.trim())           return <View key={i} style={{ height: 8 }} />;
    return <Text key={i} style={s.body}>{line.replace(/\*\*/g, '')}</Text>;
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {policy === null
          ? <ActivityIndicator color="#CC6E9A" size="large" style={{ marginTop: 60 }} />
          : policy.split('\n').map(renderLine)}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#FDF0F8' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#3D1440' },
  content: { padding: 20, paddingTop: 8 },
  h1:     { fontSize: 22, fontWeight: '900', color: '#3D1440', marginBottom: 10 },
  h2:     { fontSize: 16, fontWeight: '800', color: '#CC6E9A', marginTop: 16, marginBottom: 6 },
  body:   { fontSize: 14, color: '#3D1440', lineHeight: 22 },
  bullet: { fontSize: 14, color: '#3D1440', lineHeight: 22, paddingLeft: 8 },
});
