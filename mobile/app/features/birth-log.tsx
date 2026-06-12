// app/features/birth-log.tsx
// "Congratulations! Tell us about your birth" — activates postpartum mode.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../../store';
import { activatePostpartum } from '../../store/postpartumSlice';

const BIRTH_TYPES = [
  { value: 'vaginal' as const,   label: 'Vaginal',   emoji: '🌸' },
  { value: 'c_section' as const, label: 'C-section', emoji: '🏥' },
  { value: 'vbac' as const,      label: 'VBAC',      emoji: '💪' },
  { value: 'assisted' as const,  label: 'Assisted',  emoji: '🤝' },
];

const FEEDING = [
  { value: 'breastfeeding', label: 'Breastfeeding' },
  { value: 'formula',       label: 'Formula' },
  { value: 'mixed',         label: 'Mixed' },
  { value: 'unknown',       label: 'Not sure yet' },
];

const SEXES = [
  { value: 'female',  label: 'Girl 🎀' },
  { value: 'male',    label: 'Boy 💙' },
  { value: 'unknown', label: 'Prefer not to say' },
];

export default function BirthLog() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const status   = useAppSelector((s) => s.postpartum.status);

  const today = new Date().toISOString().slice(0, 10);
  const [birthDate, setBirthDate]   = useState(today);
  const [birthTime, setBirthTime]   = useState('');
  const [birthType, setBirthType]   = useState<typeof BIRTH_TYPES[number]['value'] | null>(null);
  const [babyName, setBabyName]     = useState('');
  const [babySex, setBabySex]       = useState<string | null>(null);
  const [weightKg, setWeightKg]     = useState('');
  const [lengthCm, setLengthCm]     = useState('');
  const [feeding, setFeeding]       = useState('unknown');
  const [complications, setComplications] = useState('');
  const [error, setError]           = useState('');

  const onSubmit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError('Please enter the birth date as YYYY-MM-DD');
      return;
    }
    if (new Date(birthDate) > new Date()) {
      setError('Birth date cannot be in the future');
      return;
    }
    setError('');

    const weightGrams = weightKg ? Math.round(parseFloat(weightKg) * 1000) : null;
    const result = await dispatch(activatePostpartum({
      birthDate,
      birthType: birthType ?? undefined,
      feedingMethod: feeding,
      babyName: babyName.trim() || null,
      babySex: babySex ?? undefined,
      birthWeightGrams: weightGrams && !isNaN(weightGrams) ? weightGrams : null,
      birthLengthCm: lengthCm ? parseFloat(lengthCm) : null,
      complications: complications.trim() || null,
    }));

    if (activatePostpartum.fulfilled.match(result)) {
      Alert.alert(
        'Congratulations! 🎉',
        `Welcome to the world${babyName.trim() ? `, ${babyName.trim()}` : ''}! Your app has switched to postpartum mode.`,
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
      );
    } else {
      setError('Could not save. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>

        <Text style={styles.confetti}>🎉</Text>
        <Text style={styles.title}>Congratulations!</Text>
        <Text style={styles.subtitle}>Tell us about your birth — we'll switch the app to support you and your newborn.</Text>

        {/* Date & time */}
        <Text style={styles.label}>Birth date *</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.label}>Birth time (optional)</Text>
        <TextInput
          style={styles.input}
          value={birthTime}
          onChangeText={setBirthTime}
          placeholder="HH:MM"
        />

        {/* Birth type */}
        <Text style={styles.label}>Birth type</Text>
        <View style={styles.chipRow}>
          {BIRTH_TYPES.map((bt) => (
            <TouchableOpacity
              key={bt.value}
              style={[styles.chip, birthType === bt.value && styles.chipActive]}
              onPress={() => setBirthType(bt.value)}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{bt.emoji}</Text>
              <Text style={[styles.chipText, birthType === bt.value && styles.chipTextActive]}>{bt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Baby */}
        <Text style={styles.label}>Baby's name (if decided)</Text>
        <TextInput style={styles.input} value={babyName} onChangeText={setBabyName} placeholder="e.g. Amara" />

        <Text style={styles.label}>Baby's sex</Text>
        <View style={styles.chipRow}>
          {SEXES.map((sx) => (
            <TouchableOpacity
              key={sx.value}
              style={[styles.chip, babySex === sx.value && styles.chipActive]}
              onPress={() => setBabySex(sx.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, babySex === sx.value && styles.chipTextActive]}>{sx.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row2}>
          <View style={styles.half}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput style={styles.input} value={weightKg} onChangeText={setWeightKg} placeholder="3.4" keyboardType="decimal-pad" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Length (cm)</Text>
            <TextInput style={styles.input} value={lengthCm} onChangeText={setLengthCm} placeholder="50" keyboardType="decimal-pad" />
          </View>
        </View>

        {/* Feeding */}
        <Text style={styles.label}>How are you feeding?</Text>
        <View style={styles.chipRow}>
          {FEEDING.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, feeding === f.value && styles.chipActive]}
              onPress={() => setFeeding(f.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, feeding === f.value && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Complications */}
        <Text style={styles.label}>Any complications? (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={complications}
          onChangeText={setComplications}
          placeholder="e.g. heavy bleeding, high blood pressure, NICU stay…"
          multiline
        />
        <Text style={styles.hint}>This helps us tailor your recovery content. It is not medical advice.</Text>

        {/* First photo — placeholder until expo-image-picker is added */}
        <TouchableOpacity style={styles.photoBtn} activeOpacity={0.8}
          onPress={() => Alert.alert('Coming soon', 'Photo upload will be available in the next update.')}>
          <Ionicons name="camera-outline" size={20} color="#CC6E9A" />
          <Text style={styles.photoBtnText}>Add baby's first photo</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} disabled={status === 'submitting'} activeOpacity={0.85}>
          {status === 'submitting'
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.submitText}>Start postpartum journey 💕</Text>}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: '#FDF0F8' },
  screen:     { flex: 1 },
  content:    { padding: 24, paddingTop: 56 },
  back:       { marginBottom: 16 },
  confetti:   { fontSize: 48, textAlign: 'center' },
  title:      { fontSize: 30, fontWeight: '800', color: '#3D1440', textAlign: 'center', marginTop: 8 },
  subtitle:   { fontSize: 14, color: '#8A7359', textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },

  label:      { fontSize: 13, fontWeight: '700', color: '#3D1440', marginBottom: 6, marginTop: 14 },
  input:      { backgroundColor: '#FFFDF9', borderRadius: 12, padding: 14, fontSize: 15, color: '#3D1440', borderWidth: 1, borderColor: '#EEE5D8' },
  multiline:  { minHeight: 80, textAlignVertical: 'top' },
  hint:       { fontSize: 11, color: '#A8997F', marginTop: 6 },

  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFDF9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: '#EEE5D8' },
  chipActive: { backgroundColor: '#CC6E9A', borderColor: '#CC6E9A' },
  chipEmoji:  { fontSize: 14 },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#5A4636' },
  chipTextActive: { color: '#FFFFFF' },

  row2:       { flexDirection: 'row', gap: 12 },
  half:       { flex: 1 },

  photoBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, borderRadius: 12, borderWidth: 1.5, borderColor: '#CC6E9A', borderStyle: 'dashed', paddingVertical: 14 },
  photoBtnText: { color: '#CC6E9A', fontWeight: '600', fontSize: 14 },

  error:      { color: '#C0524A', marginTop: 12, textAlign: 'center' },
  submitBtn:  { backgroundColor: '#CC6E9A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
