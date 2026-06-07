// app/(tabs)/profile.tsx
// User profile, settings, partner mode toggle.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../../store';
import { togglePartnerMode } from '../../store/profileSlice';

export default function Profile() {
  const { user, signOut } = useAuth();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card title="Account">
        <Text style={styles.row}>Email: {user?.email}</Text>
        <Text style={styles.row}>Account type: {user?.accountType}</Text>
      </Card>

      <Card title="Pregnancy">
        <Text style={styles.row}>Current week: {profile?.currentWeek ?? '—'}</Text>
        <Text style={styles.row}>Trimester: {profile?.trimester ?? '—'}</Text>
        <Text style={styles.row}>Due date: {profile?.dueDate ?? '—'}</Text>
        <Text style={styles.row}>Country: {profile?.country ?? '—'}</Text>
        <Text style={styles.row}>Track: {profile?.contentTrack ?? 'standard'}</Text>
      </Card>

      <Card title="Settings">
        <View style={styles.switchRow}>
          <Text style={styles.row}>Partner mode</Text>
          <Switch
            value={Boolean(profile?.partnerMode)}
            onValueChange={() => dispatch(togglePartnerMode())}
            trackColor={{ true: '#C97B63' }}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.row}>Postpartum mode</Text>
          <Switch value={Boolean(profile?.postpartum)} disabled trackColor={{ true: '#C97B63' }} />
        </View>
        <Text style={styles.hint}>
          Language: {profile?.language ?? 'English'} — set automatically from your onboarding.
        </Text>
      </Card>

      <Button title="Sign Out" variant="secondary" onPress={() => signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  container: { padding: 20 },
  row: { fontSize: 15, color: '#5C4F40', marginVertical: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  hint: { fontSize: 12, color: '#9C8B76', marginTop: 8 },
});
