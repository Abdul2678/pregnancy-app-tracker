// app/(partner)/checklist.tsx
// Read-only shared hospital bag checklist for partner.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';

interface ChecklistItem {
  item: string;
  essential: boolean;
  note: string | null;
}

interface Category {
  name: string;
  items: ChecklistItem[];
}

export default function PartnerChecklist() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [checked, setChecked]       = useState<Record<string, boolean>>({});
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/partner/checklist')
      .then(({ data }) => {
        const payload = data?.data ?? data;
        const cats = payload?.checklist?.categories ?? payload?.categories ?? [];
        setCategories(cats);
        const exp: Record<string, boolean> = {};
        cats.forEach((c: Category) => { exp[c.name] = true; });
        setExpanded(exp);
      })
      .catch(() => setError('Could not load checklist. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleExpand = (name: string) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  const totalItems   = categories.reduce((s, c) => s + c.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const pct          = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Hospital Bag</Text>
      <Text style={styles.subtitle}>Check off items as you pack together</Text>

      {loading && <ActivityIndicator color="#CC6E9A" style={{ marginTop: 40 }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error && (
        <>
          {/* Progress */}
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>{checkedCount} / {totalItems} packed</Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
          </View>

          {categories.map((cat) => (
            <View key={cat.name} style={styles.categoryCard}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleExpand(cat.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Ionicons
                  name={expanded[cat.name] ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#A8997F"
                />
              </TouchableOpacity>

              {expanded[cat.name] && cat.items.map((item, i) => {
                const id = `${cat.name}_${i}`;
                const done = !!checked[id];
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.itemRow}
                    onPress={() => toggle(id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, done && styles.checkboxDone]}>
                      {done && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemText, done && styles.itemTextDone]}>{item.item}</Text>
                      {item.essential && !done && (
                        <Text style={styles.essentialTag}>Essential</Text>
                      )}
                      {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: '#FDF0F8' },
  content:        { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title:          { fontSize: 28, fontWeight: '800', color: '#3D1440', marginBottom: 4 },
  subtitle:       { fontSize: 14, color: '#A8997F', marginBottom: 20 },
  error:          { color: '#C0524A', textAlign: 'center', marginTop: 20 },

  progressCard:   { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 20 },
  progressRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel:  { fontSize: 14, fontWeight: '600', color: '#3D1440' },
  progressPct:    { fontSize: 14, fontWeight: '700', color: '#CC6E9A' },
  progressBg:     { height: 8, borderRadius: 4, backgroundColor: '#EEE5D8', overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 4, backgroundColor: '#CC6E9A' },

  categoryCard:   { backgroundColor: '#FFFDF9', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  categoryName:   { fontSize: 15, fontWeight: '700', color: '#3D1440' },

  itemRow:        { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: '#F4EFE9' },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD5C4', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxDone:   { backgroundColor: '#CC6E9A', borderColor: '#CC6E9A' },
  itemInfo:       { flex: 1 },
  itemText:       { fontSize: 14, color: '#3D1440' },
  itemTextDone:   { textDecorationLine: 'line-through', color: '#A8997F' },
  essentialTag:   { fontSize: 11, color: '#CC6E9A', fontWeight: '600', marginTop: 2 },
  noteText:       { fontSize: 12, color: '#A8997F', marginTop: 2, lineHeight: 16 },
});
