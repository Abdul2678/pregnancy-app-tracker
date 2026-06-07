// app/(auth)/onboarding.tsx
// Multi-step onboarding form: LMP, country, language, goals, conditions.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAppDispatch, useAppSelector } from '../../store';
import { submitOnboarding } from '../../store/profileSlice';

const GOALS = ['track_symptoms', 'learn', 'community', 'partner_connect', 'medical_track'];
const CONDITIONS = ['none', 'gestational_diabetes', 'hypertension', 'thyroid', 'other'];
const LANGUAGES = ['English', 'Spanish', 'French', 'Arabic', 'Hindi', 'Portuguese', 'Urdu'];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label.replace(/_/g, ' ')}</Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.profile.status);

  const [step, setStep] = useState(0);
  const [dateInput, setDateInput] = useState('');
  const [dateType, setDateType] = useState<'lmp' | 'due_date' | 'ivf_transfer'>('lmp');
  const [country, setCountry] = useState('US');
  const [language, setLanguage] = useState('English');
  const [goals, setGoals] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>(['none']);
  const [isFirst, setIsFirst] = useState(true);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const finish = async () => {
    await dispatch(
      submitOnboarding({ dateInput, dateType, country, language, goals, conditions, isFirst })
    ).unwrap();
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Let's personalize Bloom</Text>
      <Text style={styles.progress}>Step {step + 1} of 4</Text>

      {step === 0 && (
        <View>
          <Text style={styles.q}>When did your last period start? (or due date)</Text>
          <View style={styles.row}>
            {(['lmp', 'due_date', 'ivf_transfer'] as const).map((t) => (
              <Chip key={t} label={t} active={dateType === t} onPress={() => setDateType(t)} />
            ))}
          </View>
          <Input
            label="Date (YYYY-MM-DD)"
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="2026-01-15"
          />
          <View style={styles.row}>
            <Chip label="First pregnancy" active={isFirst} onPress={() => setIsFirst(true)} />
            <Chip label="Been here before" active={!isFirst} onPress={() => setIsFirst(false)} />
          </View>
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={styles.q}>Where are you based?</Text>
          <Input label="Country code" value={country} onChangeText={setCountry} placeholder="US" />
          <Text style={styles.q}>Preferred language</Text>
          <View style={styles.wrapRow}>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} active={language === l} onPress={() => setLanguage(l)} />
            ))}
          </View>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.q}>What brings you here?</Text>
          <View style={styles.wrapRow}>
            {GOALS.map((g) => (
              <Chip key={g} label={g} active={goals.includes(g)} onPress={() => toggle(goals, setGoals, g)} />
            ))}
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.q}>Any health conditions we should know about?</Text>
          <View style={styles.wrapRow}>
            {CONDITIONS.map((c) => (
              <Chip
                key={c}
                label={c}
                active={conditions.includes(c)}
                onPress={() => toggle(conditions, setConditions, c)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.nav}>
        {step > 0 ? (
          <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} style={styles.navBtn} />
        ) : null}
        {step < 3 ? (
          <Button title="Next" onPress={() => setStep(step + 1)} style={styles.navBtn} />
        ) : (
          <Button title="Finish" onPress={finish} loading={status === 'loading'} style={styles.navBtn} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 24, paddingTop: 80 },
  heading: { fontSize: 26, fontWeight: '800', color: '#5A4636' },
  progress: { color: '#9C8B76', marginBottom: 24 },
  q: { fontSize: 16, fontWeight: '600', color: '#5A4636', marginTop: 16, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  wrapRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFE7DC',
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#C97B63' },
  chipText: { color: '#8A7359', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  nav: { flexDirection: 'row', gap: 12, marginTop: 32 },
  navBtn: { flex: 1 },
});
