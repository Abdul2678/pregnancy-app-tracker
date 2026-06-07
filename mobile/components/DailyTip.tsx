// components/DailyTip.tsx

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';

interface Tip {
  title?: string;
  body?: string;
  category?: string;
}

export function DailyTip({ tip }: { tip?: Tip | null }) {
  if (!tip) {
    return (
      <Card title="Today's Tip">
        <Text style={styles.body}>Loading your personalized tip…</Text>
      </Card>
    );
  }
  return (
    <Card>
      <Ionicons name="sparkles" size={18} color="#C97B63" style={styles.icon} />
      <Text style={styles.title}>{tip.title || "Today's Tip"}</Text>
      <Text style={styles.body}>{tip.body}</Text>
      {tip.category ? <Text style={styles.tag}>{tip.category}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  icon: { marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700', color: '#5A4636', marginBottom: 6 },
  body: { fontSize: 15, color: '#5C4F40', lineHeight: 22 },
  tag: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#EFE7DC',
    color: '#8A7359',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
});

export default DailyTip;
