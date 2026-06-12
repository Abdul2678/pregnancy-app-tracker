// app/privacy.tsx
// "Your data belongs to you" — privacy settings, data export, account deletion,
// analytics opt-out, biometric lock. Prominent by design, not buried.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Alert, Platform, TextInput, Share, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import api from '../lib/api';
import { setAnalyticsOptOut } from '../lib/analytics';
import {
  isBiometricAvailable, isBiometricLockEnabled, setBiometricLockEnabled, authenticate,
} from '../lib/biometrics';
import { useAppDispatch } from '../store';
import { logout } from '../store/authSlice';

type DataRow = { category: string; what: string; why: string; shared: string };

export default function PrivacyScreen() {
  const router   = useRouter();
  const dispatch = useAppDispatch();

  const [summary, setSummary]   = useState<DataRow[]>([]);
  const [settings, setSettings] = useState({
    shareWithPartner: false,
    anonymisedResearch: false,
    analyticsOptOut: false,
  });
  const [deletionAt, setDeletionAt] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled]     = useState(false);

  // Delete flow
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [password, setPassword]     = useState('');
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sumRes, setRes] = await Promise.all([
          api.get('/privacy/summary'),
          api.get('/privacy/settings'),
        ]);
        const sum = sumRes.data?.data ?? sumRes.data;
        const set = setRes.data?.data ?? setRes.data;
        setSummary(sum.summary ?? []);
        setSettings((s) => ({ ...s, ...(set.settings ?? {}) }));
        setDeletionAt(set.deletionRequestedAt ?? null);
      } catch {}
      setBioAvailable(await isBiometricAvailable());
      setBioEnabled(await isBiometricLockEnabled());
      setLoading(false);
    })();
  }, []);

  const saveSetting = useCallback(async (key: string, value: boolean) => {
    setSettings((s) => ({ ...s, [key]: value }));
    if (key === 'analyticsOptOut') await setAnalyticsOptOut(value);
    try {
      await api.put('/privacy/settings', { [key]: value });
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
    }
  }, []);

  const onToggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await authenticate();
      if (!success) return;
    }
    setBioEnabled(value);
    await setBiometricLockEnabled(value);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/privacy/export');
      const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await Share.share({
        message: json.length > 90000 ? json.slice(0, 90000) + '\n…(truncated for share — full file available via email export)' : json,
        title: 'My Bloom data export',
      });
    } catch {
      Alert.alert('Export failed', 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const { data } = await api.post('/privacy/delete-account', {
        password: password || undefined,
        confirmPhrase: password ? undefined : 'DELETE',
      });
      const d = data?.data ?? data;
      setDeleteStep(0);
      Alert.alert(
        'Account deletion scheduled',
        d.message ?? 'All your data will be erased within 48 hours.',
        [{ text: 'OK', onPress: async () => { await dispatch(logout()); router.replace('/(auth)'); } }]
      );
    } catch (e: any) {
      Alert.alert('Could not delete', e?.response?.data?.error ?? 'Please check your password.');
    } finally {
      setDeleting(false);
    }
  };

  const onCancelDeletion = async () => {
    try {
      await api.post('/privacy/cancel-deletion');
      setDeletionAt(null);
      Alert.alert('Deletion cancelled', 'Welcome back. Your data is safe.');
    } catch {
      Alert.alert('Could not cancel', 'Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color="#CC6E9A" size="large" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🔐</Text>
          <Text style={s.heroTitle}>Your data belongs to you</Text>
          <Text style={s.heroSub}>
            We never sell your data. No ad trackers, no data brokers, no Facebook SDK.
            Everything below is under your control.
          </Text>
        </View>

        {/* Pending deletion banner */}
        {deletionAt && (
          <View style={s.deletionBanner}>
            <Text style={s.deletionTitle}>⏳ Account deletion is scheduled</Text>
            <Text style={s.deletionText}>
              All your data will be permanently erased within 48 hours of your request.
            </Text>
            <TouchableOpacity style={s.cancelDelBtn} onPress={onCancelDeletion}>
              <Text style={s.cancelDelText}>Cancel deletion</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* What we store */}
        <Text style={s.sectionTitle}>What we store, and why</Text>
        {summary.map((row) => (
          <View key={row.category} style={s.dataCard}>
            <Text style={s.dataCategory}>{row.category}</Text>
            <Text style={s.dataWhat}>{row.what}</Text>
            <View style={s.dataMetaRow}>
              <Text style={s.dataMetaLabel}>Why: </Text>
              <Text style={s.dataMetaText}>{row.why}</Text>
            </View>
            <View style={s.dataMetaRow}>
              <Text style={s.dataMetaLabel}>Shared: </Text>
              <Text style={s.dataMetaText}>{row.shared}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={s.policyLink} onPress={() => router.push('/privacy-policy')}>
          <Ionicons name="document-text-outline" size={16} color="#8E72B8" />
          <Text style={s.policyLinkText}>Read the full privacy policy (plain language)</Text>
        </TouchableOpacity>

        {/* Sharing toggles */}
        <Text style={s.sectionTitle}>Data sharing — all off by default</Text>
        <View style={s.card}>
          {[
            { key: 'anonymisedResearch', label: 'Anonymised research', sub: 'De-identified, aggregate-only data to improve maternal health research. Never identifiable.' },
            { key: 'analyticsOptOut', label: 'Opt out of all analytics', sub: 'Turn off even our anonymous, self-hosted usage analytics.', invert: false },
          ].map((t, i) => (
            <View key={t.key} style={[s.toggleRow, i > 0 && s.toggleRowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>{t.label}</Text>
                <Text style={s.toggleSub}>{t.sub}</Text>
              </View>
              <Switch
                value={Boolean((settings as any)[t.key])}
                onValueChange={(v) => saveSetting(t.key, v)}
                trackColor={{ false: '#E8DFD0', true: '#E5A8C6' }}
                thumbColor={(settings as any)[t.key] ? '#CC6E9A' : '#FFFFFF'}
              />
            </View>
          ))}
        </View>

        {/* Biometric lock */}
        <Text style={s.sectionTitle}>App lock</Text>
        <View style={s.card}>
          <View style={s.toggleRow}>
            <Text style={{ fontSize: 20 }}>{Platform.OS === 'ios' ? '🪪' : '👆'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>
                {Platform.OS === 'ios' ? 'Face ID / Touch ID lock' : 'Fingerprint lock'}
              </Text>
              <Text style={s.toggleSub}>
                {bioAvailable
                  ? 'Require biometric unlock when opening Bloom — protects your health data on a shared phone.'
                  : 'Not available on this device (no biometrics enrolled).'}
              </Text>
            </View>
            <Switch
              value={bioEnabled}
              disabled={!bioAvailable}
              onValueChange={onToggleBiometric}
              trackColor={{ false: '#E8DFD0', true: '#E5A8C6' }}
              thumbColor={bioEnabled ? '#CC6E9A' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* Download */}
        <Text style={s.sectionTitle}>Your data, your copy</Text>
        <TouchableOpacity style={s.exportBtn} onPress={onExport} disabled={exporting} activeOpacity={0.85}>
          {exporting
            ? <ActivityIndicator color="#FFFFFF" />
            : (
              <>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={s.exportText}>Download all my data</Text>
              </>
            )}
        </TouchableOpacity>
        <Text style={s.exportHint}>A complete copy of everything we store about you, in JSON.</Text>

        {/* Delete */}
        <Text style={s.sectionTitle}>Delete my account</Text>
        <View style={s.dangerCard}>
          <Text style={s.dangerText}>
            Deleting your account permanently erases all your data within 48 hours —
            pregnancy logs, AI conversations, everything. No copies kept "for business purposes".
          </Text>
          <TouchableOpacity style={s.dangerBtn} onPress={() => setDeleteStep(1)}>
            <Text style={s.dangerBtnText}>Delete my account…</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete confirmation modal — 2 steps */}
      <Modal visible={deleteStep > 0} transparent animationType="fade" onRequestClose={() => setDeleteStep(0)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            {deleteStep === 1 && (
              <>
                <Text style={s.modalTitle}>Are you sure?</Text>
                <Text style={s.modalBody}>
                  This permanently deletes your account and ALL your data within 48 hours.
                  {'\n\n'}Consider downloading your data first — once deleted, it cannot be recovered.
                </Text>
                <TouchableOpacity style={s.modalSecondary} onPress={() => { setDeleteStep(0); onExport(); }}>
                  <Text style={s.modalSecondaryText}>Download my data first</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalDanger} onPress={() => setDeleteStep(2)}>
                  <Text style={s.modalDangerText}>Continue to delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalCancel} onPress={() => setDeleteStep(0)}>
                  <Text style={s.modalCancelText}>Keep my account</Text>
                </TouchableOpacity>
              </>
            )}
            {deleteStep === 2 && (
              <>
                <Text style={s.modalTitle}>Confirm with your password</Text>
                <Text style={s.modalBody}>
                  Enter your password to confirm. If you signed in with Apple or Google, leave this blank.
                </Text>
                <TextInput
                  style={s.modalInput}
                  placeholder="Your password"
                  placeholderTextColor="#C8B8A2"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={s.modalDanger} onPress={onDelete} disabled={deleting}>
                  {deleting
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={s.modalDangerText}>Permanently delete everything</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.modalCancel} onPress={() => { setDeleteStep(0); setPassword(''); }}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#FDF0F8' },
  center:  { alignItems: 'center', justifyContent: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#3D1440' },
  content: { padding: 20, paddingTop: 4 },

  hero:     { backgroundColor: '#F3E9F8', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24 },
  heroEmoji: { fontSize: 36, marginBottom: 8 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#3D1440', marginBottom: 8, textAlign: 'center' },
  heroSub:   { fontSize: 13, color: '#5A4636', lineHeight: 20, textAlign: 'center' },

  deletionBanner: { backgroundColor: '#FFF0F0', borderRadius: 16, padding: 16, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#D63B5A' },
  deletionTitle:  { fontSize: 14, fontWeight: '800', color: '#D63B5A', marginBottom: 6 },
  deletionText:   { fontSize: 13, color: '#5A4636', lineHeight: 19, marginBottom: 12 },
  cancelDelBtn:   { backgroundColor: '#3D1440', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelDelText:  { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#3D1440', marginBottom: 10, marginTop: 4 },

  dataCard:     { backgroundColor: '#FFFDF9', borderRadius: 14, padding: 14, marginBottom: 8 },
  dataCategory: { fontSize: 13, fontWeight: '800', color: '#CC6E9A', marginBottom: 4 },
  dataWhat:     { fontSize: 13, color: '#3D1440', lineHeight: 18, marginBottom: 6 },
  dataMetaRow:  { flexDirection: 'row', marginBottom: 2 },
  dataMetaLabel: { fontSize: 11, fontWeight: '800', color: '#8A7359' },
  dataMetaText: { fontSize: 11, color: '#8A7359', flex: 1, lineHeight: 15 },

  policyLink:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, marginBottom: 10 },
  policyLinkText: { color: '#8E72B8', fontSize: 13, fontWeight: '700' },

  card:    { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 6, marginBottom: 24 },
  toggleRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: '#F5EAE0' },
  toggleLabel:     { fontSize: 14, fontWeight: '700', color: '#3D1440' },
  toggleSub:       { fontSize: 11, color: '#8A7359', marginTop: 2, lineHeight: 15 },

  exportBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8E72B8', borderRadius: 16, paddingVertical: 15 },
  exportText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  exportHint: { fontSize: 11, color: '#A08070', textAlign: 'center', marginTop: 8, marginBottom: 24 },

  dangerCard: { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 16, marginBottom: 8 },
  dangerText: { fontSize: 13, color: '#5A4636', lineHeight: 19, marginBottom: 14 },
  dangerBtn:  { borderWidth: 1.5, borderColor: '#D63B5A', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  dangerBtnText: { color: '#D63B5A', fontWeight: '800', fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(61,20,64,0.5)', justifyContent: 'center', padding: 24 },
  modalCard:     { backgroundColor: '#FDF0F8', borderRadius: 24, padding: 24 },
  modalTitle:    { fontSize: 18, fontWeight: '900', color: '#3D1440', marginBottom: 10, textAlign: 'center' },
  modalBody:     { fontSize: 13, color: '#5A4636', lineHeight: 20, marginBottom: 18, textAlign: 'center' },
  modalInput:    { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#3D1440', marginBottom: 14 },
  modalSecondary: { backgroundColor: '#8E72B8', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  modalSecondaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  modalDanger:   { backgroundColor: '#D63B5A', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  modalDangerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  modalCancel:   { paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#8A7359', fontWeight: '700', fontSize: 14 },
});
