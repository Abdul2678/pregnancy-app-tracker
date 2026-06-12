// app/(auth)/forgot-password.tsx
// 2-step password reset: email → 6-digit OTP + new password.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '../../lib/api';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep]       = useState<1 | 2>(1);
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]       = useState(false);

  const requestOtp = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setStep(2);
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (otp.length !== 6 || password.length < 8) {
      Alert.alert('Check your details', 'The code is 6 digits and your new password needs at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(), otp, newPassword: password,
      });
      Alert.alert('Password updated 🌸', 'Sign in with your new password.', [
        { text: 'Sign in', onPress: () => router.replace('/(auth)') },
      ]);
    } catch (e: any) {
      Alert.alert('Could not reset', e?.response?.data?.error ?? 'Invalid or expired code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#3D1440" />
      </TouchableOpacity>

      <Text style={s.title}>Reset your password</Text>

      {step === 1 && (
        <>
          <Text style={s.sub}>Enter your email and we'll send a 6-digit code (valid for 10 minutes).</Text>
          <TextInput
            style={s.input}
            placeholder="Email address"
            placeholderTextColor="#C8B8A2"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity style={s.btn} onPress={requestOtp} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Send code</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={s.sub}>We sent a code to {email}. Enter it with your new password.</Text>
          <TextInput
            style={[s.input, s.otpInput]}
            placeholder="6-digit code"
            placeholderTextColor="#C8B8A2"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
          <TextInput
            style={s.input}
            placeholder="New password (8+ characters)"
            placeholderTextColor="#C8B8A2"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={s.btn} onPress={resetPassword} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Set new password</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.resend} onPress={requestOtp} disabled={busy}>
            <Text style={s.resendText}>Resend code</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FDF0F8', padding: 24, paddingTop: Platform.OS === 'ios' ? 64 : 32 },
  back:   { marginBottom: 24 },
  title:  { fontSize: 24, fontWeight: '900', color: '#3D1440', marginBottom: 10 },
  sub:    { fontSize: 14, color: '#5A4636', lineHeight: 20, marginBottom: 24 },
  input:  { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#3D1440', marginBottom: 12 },
  otpInput: { letterSpacing: 8, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  btn:    { backgroundColor: '#CC6E9A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  resend: { alignItems: 'center', paddingVertical: 16 },
  resendText: { color: '#8E72B8', fontWeight: '700', fontSize: 13 },
});
