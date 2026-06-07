// app/features/birth-plan.tsx
// Birth plan builder screen.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import api from '../../lib/api';

export default function BirthPlan() {
  const [environment, setEnvironment] = useState('');
  const [painRelief, setPainRelief] = useState('');
  const [support, setSupport] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const build = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/features/birth-plan', {
        preferences: { environment, painRelief, support },
      });
      setPlan(data.plan);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card title="Your Preferences">
        <Input label="Birth environment" value={environment} onChangeText={setEnvironment} placeholder="e.g. dim lights, music" multiline />
        <Input label="Pain relief" value={painRelief} onChangeText={setPainRelief} placeholder="e.g. open to epidural" multiline />
        <Input label="Support people" value={support} onChangeText={setSupport} placeholder="e.g. partner present" multiline />
        <Button title="Build My Birth Plan" onPress={build} loading={loading} />
      </Card>

      {plan ? (
        <Card title={plan.title || 'Birth Plan'}>
          {(plan.sections || []).map((s: any, i: number) => (
            <View key={i} style={styles.section}>
              <Text style={styles.heading}>{s.heading}</Text>
              {(s.preferences || []).map((p: string, j: number) => (
                <Text key={j} style={styles.item}>• {p}</Text>
              ))}
            </View>
          ))}
          {plan.summary ? <Text style={styles.summary}>{plan.summary}</Text> : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  section: { marginBottom: 12 },
  heading: { fontSize: 15, fontWeight: '700', color: '#5A4636', marginBottom: 4 },
  item: { fontSize: 14, color: '#5C4F40', lineHeight: 21 },
  summary: { marginTop: 8, fontStyle: 'italic', color: '#8A7359' },
});
