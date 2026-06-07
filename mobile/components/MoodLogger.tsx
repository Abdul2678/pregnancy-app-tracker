// components/MoodLogger.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useTracking } from '../hooks/useTracking';

const MOODS = [
  { emoji: '😀', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😟', label: 'Low' },
  { emoji: '😢', label: 'Struggling' },
];

export function MoodLogger() {
  const { submitMood, status } = useTracking();
  const [mood, setMood] = useState('Good');
  const [note, setNote] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  const onSubmit = async () => {
    const res = await submitMood({ mood, note: note.trim() || undefined });
    setAnalysis(res.analysis);
    setNote('');
  };

  return (
    <Card title="How are you feeling?">
      <View style={styles.row}>
        {MOODS.map((m) => (
          <Pressable
            key={m.label}
            onPress={() => setMood(m.label)}
            style={[styles.mood, mood === m.label && styles.moodActive]}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
            <Text style={styles.moodLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Input
        label="Anything on your mind?"
        value={note}
        onChangeText={setNote}
        placeholder="Optional note…"
        multiline
      />
      <Button title="Log Mood" onPress={onSubmit} loading={status === 'submitting'} />
      {analysis ? (
        <View style={styles.result}>
          <Text style={styles.resultText}>{analysis.reflection}</Text>
          {analysis.resourcePrompt ? (
            <Text style={styles.resource}>{analysis.resourcePrompt}</Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mood: { alignItems: 'center', padding: 8, borderRadius: 12, width: 60 },
  moodActive: { backgroundColor: '#EFE7DC' },
  emoji: { fontSize: 26 },
  moodLabel: { fontSize: 11, color: '#8A7359', marginTop: 2 },
  result: { marginTop: 14, backgroundColor: '#F4F1EA', borderRadius: 12, padding: 12 },
  resultText: { color: '#5C4F40', lineHeight: 20 },
  resource: { color: '#9A2C22', marginTop: 6, fontWeight: '500' },
});

export default MoodLogger;
