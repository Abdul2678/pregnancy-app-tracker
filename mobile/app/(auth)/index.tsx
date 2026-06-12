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
  TouchableOpacity,
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

  // Social sign-in: native SDKs (expo-apple-authentication / Google sign-in)
  // produce an identityToken which POST /auth/social verifies server-side.
  const onSocial = async (provider: 'apple' | 'google') => {
    try {
      if (provider === 'apple') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AppleAuth = require('expo-apple-authentication');
        const cred = await AppleAuth.signInAsync({
          requestedScopes: [
            AppleAuth.AppleAuthenticationScope.FULL_NAME,
            AppleAuth.AppleAuthenticationScope.EMAIL,
          ],
        });
        await socialSignIn('apple', cred.identityToken, cred.fullName?.givenName ?? undefined);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.hasPlayServices();
        const result = await GoogleSignin.signIn();
        await socialSignIn('google', result.data?.idToken ?? result.idToken);
      }
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      // Native module not installed yet (dev build) or sign-in failed
      alert('Social sign-in will be available in the App Store / Play Store build.');
    }
  };

  const socialSignIn = async (provider: string, identityToken?: string | null, displayName?: string) => {
    if (!identityToken) throw new Error('No identity token');
    const api = (await import('../../lib/api')).default;
    const { setTokens } = await import('../../lib/api');
    const { data } = await api.post('/auth/social', { provider, identityToken, displayName });
    const d = data?.data ?? data;
    if (typeof setTokens === 'function') await setTokens(d.accessToken, d.refreshToken);
    router.replace('/(tabs)');
  };

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

        {mode === 'login' && (
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {mode === 'register' && (
          <Text style={styles.consentText}>
            By creating an account you agree to our{' '}
            <Text style={styles.consentLink} onPress={() => router.push('/privacy-policy')}>
              plain-language privacy policy
            </Text>
            . Your data is never sold — and you can delete everything, any time.
          </Text>
        )}

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

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        {/* Social sign-in — Apple (required for iOS) + Google. No Facebook, by design. */}
        <View style={styles.socialRow}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtn} onPress={() => onSocial('apple')} activeOpacity={0.8}>
              <Text style={styles.socialIcon}></Text>
              <Text style={styles.socialText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.socialBtn} onPress={() => onSocial('google')} activeOpacity={0.8}>
            <Text style={styles.socialIcon}>G</Text>
            <Text style={styles.socialText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.partnerButton}
          onPress={() => router.push('/(auth)/partner-join')}
          activeOpacity={0.8}
        >
          <Text style={styles.partnerIcon}>🤝</Text>
          <View>
            <Text style={styles.partnerTitle}>Join as a partner</Text>
            <Text style={styles.partnerSub}>Enter the 6-digit code from your partner's app</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1, backgroundColor: '#F4F1EA' },
  container:     { padding: 24, paddingTop: 100, flexGrow: 1 },
  logo:          { fontSize: 44, fontWeight: '800', color: '#C97B63', textAlign: 'center' },
  tagline:       { fontSize: 16, color: '#8A7359', textAlign: 'center', marginBottom: 32 },
  error:         { color: '#C0524A', marginVertical: 8 },
  forgotLink:    { color: '#8E72B8', fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 12 },
  consentText:   { fontSize: 12, color: '#8A7359', lineHeight: 17, marginBottom: 12 },
  consentLink:   { color: '#8E72B8', fontWeight: '700' },
  dividerRow:    { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider:       { flex: 1, height: 1, backgroundColor: '#DDD5C4' },
  dividerText:   { marginHorizontal: 12, color: '#A8997F', fontSize: 13 },
  socialRow:     { gap: 10, marginBottom: 20 },
  socialBtn:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DDD5C4',
    paddingVertical: 13,
  },
  socialIcon:    { fontSize: 16, fontWeight: '800', color: '#3D1440' },
  socialText:    { fontSize: 14, fontWeight: '700', color: '#3D1440' },
  partnerButton: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: '#FFFDF9',
    borderRadius:   16,
    borderWidth:    1.5,
    borderColor:    '#CC6E9A',
    padding:        16,
    gap:            14,
  },
  partnerIcon:   { fontSize: 28 },
  partnerTitle:  { fontSize: 15, fontWeight: '700', color: '#3D1440' },
  partnerSub:    { fontSize: 12, color: '#8A7359', marginTop: 2 },
});
