// components/home/PartnerInviteCard.tsx
// Card on primary user's home screen to invite partner or show link status.

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Share, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { generateInviteCode, loadPartnerStatus, revokePartner } from '../../store/partnerSlice';

export function PartnerInviteCard() {
  const dispatch = useAppDispatch();
  const { linkStatus, linkInfo, inviteCode, inviteCodeExpiry, codeLoading, linkLoading } =
    useAppSelector((s) => s.partner);

  useEffect(() => { dispatch(loadPartnerStatus()); }, [dispatch]);

  const onGenerate = async () => {
    await dispatch(generateInviteCode());
  };

  const onShare = () => {
    if (!inviteCode) return;
    Share.share({
      message: `Join me on Bloom to follow our pregnancy journey! 💕\n\nDownload Bloom and enter code: ${inviteCode}\n\nCode expires in 48 hours.`,
    });
  };

  const onRevoke = () => {
    Alert.alert(
      'Remove partner?',
      'Your partner will no longer have access to your pregnancy data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => dispatch(revokePartner()) },
      ]
    );
  };

  if (linkLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#CC6E9A" />
      </View>
    );
  }

  // Already linked
  if (linkStatus === 'accepted') {
    const partnerName = linkInfo?.partner_display_name || 'Your partner';
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatarCircle}>
            <Ionicons name="people" size={22} color="#CC6E9A" />
          </View>
          <View style={styles.info}>
            <Text style={styles.linkedTitle}>{partnerName} is connected 💕</Text>
            <Text style={styles.linkedSub}>They can see your weekly updates and shared plans</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.revokeBtn} onPress={onRevoke} activeOpacity={0.8}>
          <Text style={styles.revokeTxt}>Remove partner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Code generated, waiting for partner
  if (inviteCode) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Share this code with your partner</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{inviteCode}</Text>
        </View>
        <Text style={styles.codeSub}>Expires in 48 hours • Ask them to open Bloom and tap "Join as partner"</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={onShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={16} color="#FFFFFF" />
          <Text style={styles.shareTxt}>Share code</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Pending invite with no code yet
  if (linkStatus === 'pending') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Invite pending</Text>
        <Text style={styles.cardSub}>Waiting for your partner to accept. Generate a new code to share in-app.</Text>
        <TouchableOpacity style={styles.generateBtn} onPress={onGenerate} disabled={codeLoading} activeOpacity={0.8}>
          {codeLoading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.generateTxt}>Generate 6-digit code</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // No partner yet
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person-add" size={22} color="#CC6E9A" />
        </View>
        <View style={styles.info}>
          <Text style={styles.cardTitle}>Invite your partner</Text>
          <Text style={styles.cardSub}>Share your journey — let them follow along and help plan</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.generateBtn} onPress={onGenerate} disabled={codeLoading} activeOpacity={0.8}>
        {codeLoading
          ? <ActivityIndicator color="#FFFFFF" size="small" />
          : <Text style={styles.generateTxt}>Generate invite code</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card:          { backgroundColor: '#FFFDF9', borderRadius: 20, padding: 20, marginHorizontal: 20, marginBottom: 16, shadowColor: '#3D1440', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 3 },
  row:           { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 },
  avatarCircle:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDF0F8', alignItems: 'center', justifyContent: 'center' },
  info:          { flex: 1 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#3D1440', marginBottom: 4 },
  cardSub:       { fontSize: 13, color: '#8A7359', lineHeight: 18 },
  linkedTitle:   { fontSize: 15, fontWeight: '700', color: '#3D1440', marginBottom: 3 },
  linkedSub:     { fontSize: 13, color: '#8A7359', lineHeight: 18 },
  codeBox:       { backgroundColor: '#FDF0F8', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 10 },
  codeText:      { fontSize: 38, fontWeight: '900', color: '#CC6E9A', letterSpacing: 8 },
  codeSub:       { fontSize: 12, color: '#A8997F', textAlign: 'center', marginBottom: 14, lineHeight: 18 },
  generateBtn:   { backgroundColor: '#CC6E9A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  generateTxt:   { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  shareBtn:      { backgroundColor: '#8E72B8', borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareTxt:      { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  revokeBtn:     { alignItems: 'center', paddingVertical: 8 },
  revokeTxt:     { color: '#C0524A', fontSize: 13 },
});
