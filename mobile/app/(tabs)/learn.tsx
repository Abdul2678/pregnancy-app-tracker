// app/(tabs)/learn.tsx
// Weekly development content + baby name tool.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import api from '../../lib/api';
import { useAppSelector } from '../../store';

export default function Learn() {
  const profile = useAppSelector((s) => s.profile.profile);
  const week = profile?.currentWeek ?? 1;
  const [development, setDevelopment] = useState<any>(null);
  const [names, setNames] = useState<any[]>([]);
  const [gender, setGender] = useState('any');
  const [loadingNames, setLoadingNames] = useState(false);

  useEffect(() => {
    api
      .get(`/content/week/${week}`)
      .then((r) => setDevelopment(r.data.content))
      .catch(() => setDevelopment(null));
  }, [week]);

  const suggestNames = async () => {
    setLoadingNames(true);
    try {
      const { data } = await api.post('/features/baby-names', { criteria: { gender, count: 8 } });
      setNames(data.suggestions ?? []);
    } finally {
      setLoadingNames(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card title={`Week ${week} Development`}>
        {development ? (
          <View>
            {development.babySize ? <Text style={styles.line}>👶 {development.babySize}</Text> : null}
            {development.development ? <Text style={styles.body}>{development.development}</Text> : null}
            {development.momChanges ? (
              <>
                <Text style={styles.subhead}>For you</Text>
                <Text style={styles.body}>{development.momChanges}</Text>
              </>
            ) : null}
          </View>
        ) : (
          <Text style={styles.body}>Loading week content…</Text>
        )}
      </Card>

      <Card title="Baby Name Explorer">
        <Input label="Gender (boy / girl / any)" value={gender} onChangeText={setGender} />
        <Button title="Suggest Names" onPress={suggestNames} loading={loadingNames} />
        {names.map((n, i) => (
          <View key={i} style={styles.nameRow}>
            <Text style={styles.name}>{n.name}</Text>
            <Text style={styles.meaning}>
              {n.origin} · {n.meaning}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  line: { fontSize: 15, color: '#5A4636', marginBottom: 8, fontWeight: '600' },
  subhead: { fontSize: 14, fontWeight: '700', color: '#5A4636', marginTop: 10, marginBottom: 4 },
  body: { fontSize: 15, color: '#5C4F40', lineHeight: 22 },
  nameRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE5D8' },
  name: { fontSize: 16, fontWeight: '700', color: '#5A4636' },
  meaning: { fontSize: 13, color: '#9C8B76' },
});
