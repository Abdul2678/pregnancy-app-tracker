// app/(tabs)/track.tsx
// Tracking hub: symptoms, mood, weight, contractions.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { SymptomLogger } from '../../components/SymptomLogger';
import { MoodLogger } from '../../components/MoodLogger';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useTracking } from '../../hooks/useTracking';

type Tab = 'symptom' | 'mood' | 'weight';

export default function Track() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('symptom');
  const { submitWeight, status } = useTracking();
  const [weight, setWeight] = useState('');
  const [weightGuidance, setWeightGuidance] = useState<any>(null);

  const onWeight = async () => {
    const kg = parseFloat(weight);
    if (Number.isNaN(kg)) return;
    const res = await submitWeight({ weightKg: kg });
    setWeightGuidance(res.guidance);
    setWeight('');
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.tabs}>
        {(['symptom', 'mood', 'weight'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'symptom' && <SymptomLogger />}
      {tab === 'mood' && <MoodLogger />}
      {tab === 'weight' && (
        <Card title="Log Weight">
          <Input
            label="Weight (kg)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 64.5"
          />
          <Button title="Get Guidance" onPress={onWeight} loading={status === 'submitting'} />
          {weightGuidance ? (
            <View style={styles.result}>
              <Text style={styles.resultStatus}>{weightGuidance.status}</Text>
              <Text style={styles.resultText}>{weightGuidance.message}</Text>
            </View>
          ) : null}
        </Card>
      )}

      <Button
        title="Open Contraction Timer"
        variant="secondary"
        onPress={() => router.push('/features/contraction-timer')}
        style={{ marginTop: 8 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EFE7DC', alignItems: 'center' },
  tabActive: { backgroundColor: '#C97B63' },
  tabText: { color: '#8A7359', fontWeight: '600', textTransform: 'capitalize' },
  tabTextActive: { color: '#fff' },
  result: { marginTop: 14, backgroundColor: '#F4F1EA', borderRadius: 12, padding: 12 },
  resultStatus: { fontWeight: '700', color: '#5A4636', marginBottom: 4, textTransform: 'capitalize' },
  resultText: { color: '#5C4F40', lineHeight: 20 },
});
