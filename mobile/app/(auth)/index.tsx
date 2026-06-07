// app/(auth)/index.tsx
// Landing / sign-in / sign-up screen.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

export default function Landing() {
  const { signIn, signUp, error, status } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else {
        await signUp(email.trim(), password);
        router.replace('/(auth)/onboarding');
      }
    } catch {
      // error surfaced via state
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>Bloom</Text>
        <Text style={styles.tagline}>Your companion through pregnancy and beyond.</Text>

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

        <Button
          title={mode === 'login' ? 'Sign In' : 'Create Account'}
          onPress={onSubmit}
          loading={status === 'loading'}
        />
        <Button
          title={mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          variant="ghost"
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 24, paddingTop: 100, flexGrow: 1 },
  logo: { fontSize: 44, fontWeight: '800', color: '#C97B63', textAlign: 'center' },
  tagline: { fontSize: 16, color: '#8A7359', textAlign: 'center', marginBottom: 32 },
  error: { color: '#C0524A', marginVertical: 8 },
});
