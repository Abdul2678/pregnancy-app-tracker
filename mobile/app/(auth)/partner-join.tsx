// app/(auth)/partner-join.tsx
// Partner joins via 6-digit code.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function PartnerJoin() {
  const router = useRouter();
  const [step, setStep]           = useState<'code' | 'account'>('code');
  const [digits, setDigits]       = useState(['', '', '', '', '', '']);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [name, setName]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const inputRefs                 = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');

  const onDigitChange = (val: string, idx: number) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[idx]   = clean;
    setDigits(next);
    if (clean && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (!clean && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const onVerifyCode = () => {
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setError('');
    setStep('account');
  };

  const onCreateAccount = async () => {
    if (!email || !password) { setError('Email and password are required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/partner/join', {
        code,
        email:       email.trim().toLowerCase(),
        password,
        displayName: name.trim() || undefined,
      });
      Alert.alert(
        'You\'re linked! 🎉',
        'Account created. Sign in with your email and password to access your partner view.',
        [{ text: 'Sign In', onPress: () => router.replace('/(auth)') }]
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => step === 'account' ? setStep('code') : router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Join as Partner</Text>
        <Text style={styles.subtitle}>
          {step === 'code'
            ? 'Enter the 6-digit code from your partner\'s Bloom app'
            : 'Create your partner account'}
        </Text>

        {step === 'code' && (
          <>
            <View style={styles.digitRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputRefs.current[i] = r; }}
                  style={[styles.digitBox, d ? styles.digitBoxFilled : null]}
                  value={d}
                  onChangeText={(v) => onDigitChange(v, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Continue" onPress={onVerifyCode} />
          </>
        )}

        {step === 'account' && (
          <>
            <View style={styles.codeDisplay}>
              <Text style={styles.codeLabel}>Code</Text>
              <Text style={styles.codeValue}>{code}</Text>
            </View>
            <Input
              label="Your name (optional)"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Alex"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Create Partner Account" onPress={onCreateAccount} loading={loading} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: '#F4F1EA' },
  container:     { padding: 24, paddingTop: 60, flexGrow: 1 },
  back:          { marginBottom: 24 },
  backText:      { color: '#CC6E9A', fontSize: 15, fontWeight: '600' },
  title:         { fontSize: 30, fontWeight: '800', color: '#3D1440', marginBottom: 8 },
  subtitle:      { fontSize: 15, color: '#8A7359', marginBottom: 36, lineHeight: 22 },
  digitRow:      { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 32 },
  digitBox:      {
    width: 46, height: 56, borderRadius: 12,
    borderWidth: 2, borderColor: '#DDD5C4',
    backgroundColor: '#FFFDF9',
    fontSize: 24, fontWeight: '700', color: '#3D1440',
    textAlign: 'center',
  },
  digitBoxFilled: { borderColor: '#CC6E9A', backgroundColor: '#FDF0F8' },
  error:          { color: '#C0524A', marginBottom: 12, textAlign: 'center' },
  codeDisplay:   {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: '#FDF0F8',
    borderRadius:    12,
    padding:         14,
    marginBottom:    20,
  },
  codeLabel:     { fontSize: 13, color: '#CC6E9A', fontWeight: '600' },
  codeValue:     { fontSize: 22, fontWeight: '800', color: '#3D1440', letterSpacing: 4 },
});
