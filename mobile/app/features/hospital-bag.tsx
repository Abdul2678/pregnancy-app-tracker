// app/features/hospital-bag.tsx
// Hospital bag checklist.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '../../components/ui/Card';
import api from '../../lib/api';

export default function HospitalBag() {
  const [checklist, setChecklist] = useState<any>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .get('/features/hospital-bag')
      .then((r) => setChecklist(r.data.checklist))
      .catch(() => setChecklist(null));
  }, []);

  const toggle = (key: string) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {!checklist ? (
        <Text style={styles.loading}>Building your checklist…</Text>
      ) : (
        (checklist.categories || []).map((cat: any, ci: number) => (
          <Card key={ci} title={cat.name}>
            {(cat.items || []).map((it: any, ii: number) => {
              const key = `${ci}-${ii}`;
              return (
                <Pressable key={key} style={styles.item} onPress={() => toggle(key)}>
                  <Ionicons
                    name={checked[key] ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked[key] ? '#C97B63' : '#A8997F'}
                  />
                  <View style={styles.itemText}>
                    <Text style={[styles.itemLabel, checked[key] && styles.itemDone]}>
                      {it.item}
                      {it.essential ? ' ★' : ''}
                    </Text>
                    {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  loading: { textAlign: 'center', color: '#9C8B76', marginTop: 40 },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 10 },
  itemText: { flex: 1 },
  itemLabel: { fontSize: 15, color: '#5A4636' },
  itemDone: { textDecorationLine: 'line-through', color: '#A8997F' },
  note: { fontSize: 12, color: '#9C8B76' },
});
