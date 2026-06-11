// app/(partner)/names.tsx
// Tinder-style baby name voting for partner.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadPartnerNames, voteOnName } from '../../store/partnerSlice';
import { ShortlistedName } from '../../store/plannerSlice';

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.35;

function NameCard({ name, onVote }: { name: ShortlistedName; onVote: (v: 'loved' | 'maybe' | 'vetoed') => void }) {
  const pan     = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const rotate  = pan.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: ['-15deg', '0deg', '15deg'] });
  const loveOp  = pan.x.interpolate({ inputRange: [0, 60], outputRange: [0, 1], extrapolate: 'clamp' });
  const vetoOp  = pan.x.interpolate({ inputRange: [-60, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        Animated.parallel([
          Animated.timing(pan, { toValue: { x: SCREEN_W * 1.5, y: gesture.dy }, duration: 250, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
        ]).start(() => onVote('loved'));
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        Animated.parallel([
          Animated.timing(pan, { toValue: { x: -SCREEN_W * 1.5, y: gesture.dy }, duration: 250, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
        ]).start(() => onVote('vetoed'));
      } else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    },
  });

  return (
    <Animated.View
      style={[styles.card, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }], opacity }]}
      {...responder.panHandlers}
    >
      {/* Love overlay */}
      <Animated.View style={[styles.overlay, styles.loveOverlay, { opacity: loveOp }]}>
        <Text style={styles.overlayText}>💕 LOVE</Text>
      </Animated.View>
      {/* Veto overlay */}
      <Animated.View style={[styles.overlay, styles.vetoOverlay, { opacity: vetoOp }]}>
        <Text style={styles.overlayText}>✗ NOPE</Text>
      </Animated.View>

      <Text style={styles.nameText}>{name.name}</Text>
      {name.pronunciation && <Text style={styles.pronounce}>/{name.pronunciation}/</Text>}
      <View style={styles.tagRow}>
        {name.gender_fit && <View style={styles.tag}><Text style={styles.tagText}>{name.gender_fit}</Text></View>}
        {name.origin && <View style={styles.tag}><Text style={styles.tagText}>{name.origin}</Text></View>}
        {name.syllables && <View style={styles.tag}><Text style={styles.tagText}>{name.syllables} syllables</Text></View>}
      </View>
      {name.meaning && <Text style={styles.meaning}>{name.meaning}</Text>}

      <Text style={styles.swipeHint}>← Nope   •   Love →</Text>
    </Animated.View>
  );
}

export default function PartnerNames() {
  const dispatch = useAppDispatch();
  const { partnerNames, namesLoading } = useAppSelector((s) => s.partner);
  const [queueIdx, setQueueIdx]        = useState(0);
  const [voted, setVoted]              = useState<Record<string, 'loved' | 'maybe' | 'vetoed'>>({});

  useEffect(() => { dispatch(loadPartnerNames()); }, [dispatch]);

  const unvoted = partnerNames.filter((n) => !n.partner_status && !voted[n.id]);
  const current = unvoted[0] ?? null;

  const handleVote = (status: 'loved' | 'maybe' | 'vetoed') => {
    if (!current) return;
    setVoted((prev) => ({ ...prev, [current.id]: status }));
    dispatch(voteOnName({ id: current.id, status }));
  };

  const lovedNames  = partnerNames.filter((n) => n.partner_status === 'loved' || voted[n.id] === 'loved');
  const maybeNames  = partnerNames.filter((n) => n.partner_status === 'maybe' || voted[n.id] === 'maybe');
  const matchedNames = partnerNames.filter((n) => n.status === 'loved' && (n.partner_status === 'loved' || voted[n.id] === 'loved'));

  return (
    <View style={styles.screen}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Baby Names</Text>
        <Text style={styles.subtitle}>Swipe right to love, left to pass</Text>
      </View>

      {namesLoading && <ActivityIndicator color="#CC6E9A" style={{ marginTop: 40 }} />}

      {!namesLoading && partnerNames.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No names shortlisted yet.</Text>
          <Text style={styles.emptySub}>Ask your partner to add baby names to their shortlist first.</Text>
        </View>
      )}

      {!namesLoading && partnerNames.length > 0 && (
        <>
          {/* Matches banner */}
          {matchedNames.length > 0 && (
            <View style={styles.matchBanner}>
              <Text style={styles.matchText}>
                💕 You both love: {matchedNames.map((n) => n.name).join(', ')}
              </Text>
            </View>
          )}

          {/* Card stack */}
          <View style={styles.cardArea}>
            {unvoted.length === 0 ? (
              <View style={styles.doneCard}>
                <Text style={styles.doneEmoji}>🎉</Text>
                <Text style={styles.doneTitle}>All voted!</Text>
                <Text style={styles.doneSub}>You loved {lovedNames.length} name{lovedNames.length !== 1 ? 's' : ''}.</Text>
                {lovedNames.length > 0 && (
                  <View style={styles.lovedList}>
                    {lovedNames.map((n) => (
                      <View key={n.id} style={styles.lovedPill}>
                        <Text style={styles.lovedName}>{n.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Next card peek */}
                {unvoted[1] && (
                  <View style={[styles.card, styles.cardBack]}>
                    <Text style={styles.nameText}>{unvoted[1].name}</Text>
                  </View>
                )}
                <NameCard key={current!.id} name={current!} onVote={handleVote} />
              </>
            )}
          </View>

          {/* Buttons */}
          {unvoted.length > 0 && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.vetoBtn} onPress={() => handleVote('vetoed')} activeOpacity={0.8}>
                <Text style={styles.vetoBtnText}>✗</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.maybeBtn} onPress={() => handleVote('maybe')} activeOpacity={0.8}>
                <Text style={styles.maybeBtnText}>Maybe</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.loveBtn} onPress={() => handleVote('loved')} activeOpacity={0.8}>
                <Text style={styles.loveBtnText}>💕</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#FDF0F8' },
  headerArea:   { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title:        { fontSize: 28, fontWeight: '800', color: '#3D1440' },
  subtitle:     { fontSize: 14, color: '#A8997F', marginTop: 4 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText:    { fontSize: 18, fontWeight: '700', color: '#3D1440', textAlign: 'center' },
  emptySub:     { color: '#A8997F', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  matchBanner:  { marginHorizontal: 20, backgroundColor: '#CC6E9A', borderRadius: 12, padding: 12, marginBottom: 8 },
  matchText:    { color: '#FFFFFF', fontWeight: '700', textAlign: 'center', fontSize: 13 },

  cardArea:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:         {
    position: 'absolute',
    width:    SCREEN_W - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#3D1440',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
  },
  cardBack:     { transform: [{ scale: 0.95 }], backgroundColor: '#FDF0F8', top: 8 },

  overlay:      {
    position: 'absolute', top: 24, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, zIndex: 10,
  },
  loveOverlay:  { right: 20, backgroundColor: '#CC6E9A', transform: [{ rotate: '15deg' }] },
  vetoOverlay:  { left: 20, backgroundColor: '#888', transform: [{ rotate: '-15deg' }] },
  overlayText:  { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },

  nameText:     { fontSize: 44, fontWeight: '900', color: '#3D1440', textAlign: 'center' },
  pronounce:    { fontSize: 16, color: '#A8997F', marginTop: 6 },
  tagRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' },
  tag:          { backgroundColor: '#FDF0F8', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  tagText:      { fontSize: 12, color: '#CC6E9A', fontWeight: '600' },
  meaning:      { fontSize: 14, color: '#5A4636', textAlign: 'center', marginTop: 16, lineHeight: 20, fontStyle: 'italic' },
  swipeHint:    { fontSize: 12, color: '#C8B8A2', marginTop: 24 },

  doneCard:     { alignItems: 'center', padding: 32 },
  doneEmoji:    { fontSize: 56, marginBottom: 16 },
  doneTitle:    { fontSize: 28, fontWeight: '800', color: '#3D1440' },
  doneSub:      { color: '#A8997F', fontSize: 15, marginTop: 8 },
  lovedList:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, justifyContent: 'center' },
  lovedPill:    { backgroundColor: '#FDF0F8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  lovedName:    { color: '#CC6E9A', fontWeight: '700', fontSize: 14 },

  btnRow:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, paddingBottom: 32, paddingTop: 8 },
  vetoBtn:      { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFDF9', borderWidth: 2, borderColor: '#DDD5C4', alignItems: 'center', justifyContent: 'center' },
  vetoBtnText:  { fontSize: 22, color: '#888' },
  maybeBtn:     { paddingHorizontal: 20, height: 48, borderRadius: 24, backgroundColor: '#FFFDF9', borderWidth: 2, borderColor: '#8E72B8', alignItems: 'center', justifyContent: 'center' },
  maybeBtnText: { fontSize: 15, fontWeight: '700', color: '#8E72B8' },
  loveBtn:      { width: 60, height: 60, borderRadius: 30, backgroundColor: '#CC6E9A', alignItems: 'center', justifyContent: 'center' },
  loveBtnText:  { fontSize: 22 },
});
