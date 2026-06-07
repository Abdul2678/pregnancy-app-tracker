// app/features/contraction-timer.tsx
// Contraction timer + analyzer.

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTracking } from '../../hooks/useTracking';

interface Entry {
  startTime: string;
  durationSec: number;
  intervalSec?: number;
}

export default function ContractionTimer() {
  const { submitContractions, status } = useTracking();
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const startRef = useRef<number | null>(null);
  const lastStartRef = useRef<number | null>(null);

  const toggle = () => {
    const now = Date.now();
    if (!running) {
      startRef.current = now;
      setRunning(true);
    } else {
      const start = startRef.current ?? now;
      const durationSec = Math.max(1, Math.round((now - start) / 1000));
      const intervalSec = lastStartRef.current
        ? Math.round((start - lastStartRef.current) / 1000)
        : undefined;
      lastStartRef.current = start;
      setEntries((e) => [
        ...e,
        { startTime: new Date(start).toISOString(), durationSec, intervalSec },
      ]);
      setRunning(false);
    }
  };

  const analyze = async () => {
    if (!entries.length) return;
    const res = await submitContractions({ contractions: entries });
    setAnalysis(res.analysis);
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.big}>{running ? 'Timing…' : 'Ready'}</Text>
        <Button
          title={running ? 'Stop Contraction' : 'Start Contraction'}
          onPress={toggle}
          variant={running ? 'secondary' : 'primary'}
        />
        <Text style={styles.count}>{entries.length} logged this session</Text>
      </Card>

      {entries.map((e, i) => (
        <View key={i} style={styles.entry}>
          <Text style={styles.entryText}>
            #{i + 1} · {e.durationSec}s
            {e.intervalSec ? ` · interval ${Math.round(e.intervalSec / 60)}m` : ''}
          </Text>
        </View>
      ))}

      {entries.length ? (
        <Button title="Analyze Pattern" onPress={analyze} loading={status === 'submitting'} style={{ marginTop: 12 }} />
      ) : null}

      {analysis ? (
        <Card title="Analysis">
          <Text style={styles.pattern}>{analysis.pattern}</Text>
          <Text style={styles.assessment}>{analysis.assessment}</Text>
          <Text style={styles.rec}>{analysis.recommendation}</Text>
          {analysis.goToHospitalNow ? (
            <Text style={styles.alert}>Consider going to the hospital now.</Text>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  big: { fontSize: 22, fontWeight: '800', color: '#5A4636', textAlign: 'center', marginBottom: 12 },
  count: { textAlign: 'center', color: '#9C8B76', marginTop: 10 },
  entry: { backgroundColor: '#FFFDF9', borderRadius: 10, padding: 10, marginVertical: 3, borderWidth: 1, borderColor: '#EEE5D8' },
  entryText: { color: '#5C4F40' },
  pattern: { fontSize: 16, fontWeight: '700', color: '#5A4636', textTransform: 'capitalize', marginBottom: 6 },
  assessment: { color: '#5C4F40', lineHeight: 21, marginBottom: 6 },
  rec: { color: '#5C4F40', lineHeight: 21, fontWeight: '600' },
  alert: { marginTop: 8, color: '#9A2C22', fontWeight: '700' },
});
