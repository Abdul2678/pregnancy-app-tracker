// app/(tabs)/profile.tsx
// User profile, partner link management, privacy controls.

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, ActivityIndicator, Share, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  generateInviteCode, loadPartnerStatus, updatePrivacy, revokePartner,
} from '../../store/partnerSlice';

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  );
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const dispatch          = useAppDispatch();
  const profile           = useAppSelector((s) => s.profile.profile);
  const {
    linkStatus, linkInfo, inviteCode, inviteCodeExpiry,
    codeLoading, linkLoading, privacy, privacyLoading,
  } = useAppSelector((s) => s.partner);

  useEffect(() => { dispatch(loadPartnerStatus()); }, [dispatch]);

  const togglePrivacy = (key: 'shareMood' | 'shareWeight' | 'shareSymptoms', value: boolean) => {
    dispatch(updatePrivacy({ [key]: value }));
  };

  const onGenerate = () => dispatch(generateInviteCode());

  const onShare = () => {
    if (!inviteCode) return;
    Share.share({
      message: `Join me on Bloom! 💕\n\nDownload Bloom and tap "Join as partner", then enter code:\n\n${inviteCode}\n\nExpires in 48 hours.`,
    });
  };

  const onRevoke = () => {
    Alert.alert(
      'Remove partner access?',
      'Your partner will lose access to your pregnancy data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => dispatch(revokePartner()) },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Profile</Text>

      {/* Account */}
      <SectionHeader title="Account" />
      <View style={styles.card}>
        <InfoRow label="Email" value={user?.email} />
        <InfoRow label="Account type" value={user?.accountType} />
      </View>

      {/* Pregnancy info */}
      <SectionHeader title="Pregnancy" />
      <View style={styles.card}>
        <InfoRow label="Current week" value={profile?.currentWeek} />
        <InfoRow label="Trimester" value={profile?.trimester} />
        <InfoRow label="Due date" value={profile?.dueDate} />
        <InfoRow label="Country" value={profile?.country} />
        <InfoRow label="Track" value={profile?.contentTrack ?? 'standard'} />
      </View>

      {/* Partner link section */}
      <SectionHeader title="Partner Access" />
      <View style={styles.card}>
        {linkLoading && <ActivityIndicator color="#CC6E9A" style={{ marginVertical: 12 }} />}

        {!linkLoading && linkStatus === 'accepted' && (
          <>
            <View style={styles.linkedRow}>
              <View style={styles.linkedDot} />
              <Text style={styles.linkedName}>
                {linkInfo?.partner_display_name || 'Partner'} is linked
              </Text>
            </View>
            <Text style={styles.linkedSub}>They can see your weekly updates and shared plans.</Text>
            <TouchableOpacity style={styles.revokeBtn} onPress={onRevoke} activeOpacity={0.8}>
              <Text style={styles.revokeTxt}>Remove partner access</Text>
            </TouchableOpacity>
          </>
        )}

        {!linkLoading && linkStatus !== 'accepted' && !inviteCode && (
          <>
            <Text style={styles.cardBody}>
              Invite your partner to follow your pregnancy journey. They'll get their own view of
              weekly updates, the hospital bag checklist, and baby name voting.
            </Text>
            <TouchableOpacity style={styles.generateBtn} onPress={onGenerate} disabled={codeLoading} activeOpacity={0.8}>
              {codeLoading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.generateTxt}>Generate 6-digit code</Text>}
            </TouchableOpacity>
          </>
        )}

        {!linkLoading && inviteCode && (
          <>
            <Text style={styles.codeLabel}>Share this code with your partner</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{inviteCode}</Text>
            </View>
            <Text style={styles.codeSub}>
              Expires in 48 hours · They tap "Join as partner" on the sign-in screen
            </Text>
            <TouchableOpacity style={styles.shareBtn} onPress={onShare} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={16} color="#FFFFFF" />
              <Text style={styles.shareTxt}>Share code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Privacy toggles — only shown when linked */}
      {linkStatus === 'accepted' && (
        <>
          <SectionHeader title="Privacy — What Partner Can See" />
          <View style={styles.card}>
            <Text style={styles.privacyNote}>
              Week updates, appointments, checklist, and baby names are always shared.
            </Text>

            {[
              { key: 'shareMood' as const,     label: 'Mood logs',    sub: 'Daily check-in scores and journal' },
              { key: 'shareWeight' as const,   label: 'Weight',       sub: 'Latest weight log' },
              { key: 'shareSymptoms' as const, label: 'Symptoms',     sub: 'Logged symptoms and notes' },
            ].map(({ key, label, sub }) => (
              <View key={key} style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Text style={styles.toggleSub}>{sub}</Text>
                </View>
                <Switch
                  value={!!privacy[key]}
                  onValueChange={(v) => togglePrivacy(key, v)}
                  trackColor={{ false: '#DDD5C4', true: '#CC6E9A' }}
                  thumbColor="#FFFFFF"
                  disabled={privacyLoading}
                />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Sign out */}
      <Button title="Sign Out" variant="ghost" onPress={signOut} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#FDF0F8' },
  content:       { padding: 20, paddingTop: 60 },
  pageTitle:     { fontSize: 28, fontWeight: '800', color: '#3D1440', marginBottom: 24 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#A8997F', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  card:          { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 20 },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F4EFE9' },
  infoLabel:     { fontSize: 14, color: '#8A7359' },
  infoValue:     { fontSize: 14, fontWeight: '600', color: '#3D1440', maxWidth: '55%', textAlign: 'right' },

  linkedRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  linkedDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4EA86A' },
  linkedName:    { fontSize: 15, fontWeight: '700', color: '#3D1440' },
  linkedSub:     { fontSize: 13, color: '#8A7359', marginBottom: 14, lineHeight: 18 },
  revokeBtn:     { alignItems: 'center', paddingVertical: 8 },
  revokeTxt:     { color: '#C0524A', fontSize: 14 },

  cardBody:      { fontSize: 14, color: '#5A4636', lineHeight: 20, marginBottom: 16 },
  generateBtn:   { backgroundColor: '#CC6E9A', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  generateTxt:   { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  codeLabel:     { fontSize: 13, color: '#8A7359', marginBottom: 10 },
  codeBox:       { backgroundColor: '#FDF0F8', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 10 },
  codeText:      { fontSize: 38, fontWeight: '900', color: '#CC6E9A', letterSpacing: 8 },
  codeSub:       { fontSize: 12, color: '#A8997F', textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  shareBtn:      { backgroundColor: '#8E72B8', borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareTxt:      { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  privacyNote:   { fontSize: 13, color: '#A8997F', marginBottom: 16, lineHeight: 18 },
  toggleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F4EFE9' },
  toggleInfo:    { flex: 1, paddingRight: 16 },
  toggleLabel:   { fontSize: 15, fontWeight: '600', color: '#3D1440' },
  toggleSub:     { fontSize: 12, color: '#A8997F', marginTop: 2 },
});
