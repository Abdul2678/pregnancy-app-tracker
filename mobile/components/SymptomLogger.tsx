// components/SymptomLogger.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useTracking } from '../hooks/useTracking';

export function SymptomLogger() {
  const { submitSymptom, status } = useTracking();
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState(3);
  const [result, setResult] = useState<any>(null);

  const onSubmit = async () => {
    if (!text.trim()) return;
    const res = await submitSymptom({ symptomText: text.trim(), severity });
    setResult(res.triage);
    setText('');
  };

  return (
    <Card title="Log a Symptom">
      <Input
        label="What are you feeling?"
        value={text}
        onChangeText={setText}
        placeholder="e.g. mild headache since this morning"
        multiline
      />
      <Text style={styles.label}>Severity</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setSeverity(n)}
            style={[styles.dot, severity === n && styles.dotActive]}
          >
            <Text style={[styles.dotText, severity === n && styles.dotTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Assess Symptom" onPress={onSubmit} loading={status === 'submitting'} />
      {result ? (
        <View style={styles.result}>
          <Text style={styles.resultSeverity}>Assessment: {result.severity}</Text>
          <Text style={styles.resultText}>{result.explanation}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#5A4636', marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFE7DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: '#C97B63' },
  dotText: { color: '#8A7359', fontWeight: '700' },
  dotTextActive: { color: '#fff' },
  result: { marginTop: 14, backgroundColor: '#F4F1EA', borderRadius: 12, padding: 12 },
  resultSeverity: { fontWeight: '700', color: '#5A4636', marginBottom: 4 },
  resultText: { color: '#5C4F40', lineHeight: 20 },
});

export default SymptomLogger;
