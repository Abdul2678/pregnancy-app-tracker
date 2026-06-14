// app/features/newborn-tracker.tsx
// Newborn tracker: feeding, sleep, and diaper logs with today's summary and 24h timeline.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  logNewborn, loadNewbornLogs, loadTodaySummary, NewbornLog,
} from '../../store/postpartumSlice';

type Tab = 'feeding' | 'sleep' | 'diaper';

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'feeding', label: 'Feed',   emoji: '🍼' },
  { key: 'sleep',   label: 'Sleep',  emoji: '😴' },
  { key: 'diaper',  label: 'Diaper', emoji: '🧷' },
];

const TAB_COLORS: Record<Tab, string> = {
  feeding: '#CC6E9A',
  sleep:   '#8E72B8',
  diaper:  '#5BA88C',
};

// ── 24h timeline chart ──────────────────────────────────────────────────────

function TimelineChart({ logs }: { logs: NewbornLog[] }) {
  const W = 320, H = 90, ROW_H = 20, PAD = 4;
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const msInDay = 86400000;

  const xFor = (d: Date) => Math.max(0, Math.min(W, ((d.getTime() - dayStart.getTime()) / msInDay) * W));

  const rows: { type: Tab; y: number }[] = [
    { type: 'feeding', y: PAD },
    { type: 'sleep',   y: PAD + ROW_H + 6 },
    { type: 'diaper',  y: PAD + (ROW_H + 6) * 2 },
  ];

  const todayLogs = logs.filter((l) => new Date(l.logged_at) >= dayStart);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* hour gridlines every 6h */}
      {[0, 6, 12, 18, 24].map((h) => (
        <React.Fragment key={h}>
          <Line x1={(h / 24) * W} y1={0} x2={(h / 24) * W} y2={H - 14} stroke="#F4EFE9" strokeWidth={1} />
          <SvgText x={(h / 24) * W} y={H - 2} fontSize={9} fill="#A8997F" textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}>
            {h === 24 ? '24h' : `${h}h`}
          </SvgText>
        </React.Fragment>
      ))}

      {rows.map((row) => {
        const items = todayLogs.filter((l) => l.log_type === row.type);
        return items.map((l) => {
          if (row.type === 'sleep' && l.sleep_start && l.sleep_end) {
            const x1 = xFor(new Date(l.sleep_start));
            const x2 = xFor(new Date(l.sleep_end));
            return (
              <Rect key={l.id} x={x1} y={row.y} width={Math.max(3, x2 - x1)} height={ROW_H - 6}
                rx={3} fill={TAB_COLORS[row.type]} opacity={0.85} />
            );
          }
          const x = xFor(new Date(l.logged_at));
          return (
            <Rect key={l.id} x={x - 2} y={row.y} width={5} height={ROW_H - 6}
              rx={2} fill={TAB_COLORS[row.type]} opacity={0.9} />
          );
        });
      })}
    </Svg>
  );
}

// ── Log forms ───────────────────────────────────────────────────────────────

function FeedForm({ onSave, saving }: { onSave: (p: Record<string, any>) => void; saving: boolean }) {
  const [mode, setMode]         = useState<'breast' | 'bottle'>('breast');
  const [side, setSide]         = useState<'breast_left' | 'breast_right' | 'both_breasts'>('breast_left');
  const [duration, setDuration] = useState('');
  const [amount, setAmount]     = useState('');

  return (
    <View>
      <View style={fs.toggleRow}>
        {(['breast', 'bottle'] as const).map((m) => (
          <TouchableOpacity key={m} style={[fs.toggle, mode === m && fs.toggleActive]} onPress={() => setMode(m)}>
            <Text style={[fs.toggleText, mode === m && fs.toggleTextActive]}>{m === 'breast' ? '🤱 Breast' : '🍼 Bottle'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'breast' ? (
        <>
          <Text style={fs.label}>Which side?</Text>
          <View style={fs.chipRow}>
            {([['breast_left', 'Left'], ['breast_right', 'Right'], ['both_breasts', 'Both']] as const).map(([v, l]) => (
              <TouchableOpacity key={v} style={[fs.chip, side === v && fs.chipActive]} onPress={() => setSide(v)}>
                <Text style={[fs.chipText, side === v && fs.chipTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={fs.label}>Duration (minutes)</Text>
          <TextInput style={fs.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="15" />
        </>
      ) : (
        <>
          <Text style={fs.label}>Amount (ml)</Text>
          <TextInput style={fs.input} value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="90" />
        </>
      )}

      <TouchableOpacity
        style={fs.saveBtn}
        disabled={saving}
        onPress={() => onSave({
          logType: 'feeding',
          feedingType: mode === 'breast' ? side : 'formula',
          feedingDurationMin: mode === 'breast' && duration ? parseInt(duration, 10) : undefined,
          feedingAmountMl: mode === 'bottle' && amount ? parseFloat(amount) : undefined,
        })}
      >
        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={fs.saveText}>Log feed</Text>}
      </TouchableOpacity>
    </View>
  );
}

function SleepForm({ onSave, saving }: { onSave: (p: Record<string, any>) => void; saving: boolean }) {
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const [start, setStart] = useState(fmt(oneHourAgo));
  const [end, setEnd]     = useState(fmt(now));
  const [error, setError] = useState('');

  const toIso = (hhmm: string): string | null => {
    const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const d = new Date();
    d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
    if (d > new Date()) d.setDate(d.getDate() - 1); // assume yesterday if in future
    return d.toISOString();
  };

  return (
    <View>
      <Text style={fs.label}>Sleep started (HH:MM)</Text>
      <TextInput style={fs.input} value={start} onChangeText={setStart} placeholder="14:30" />
      <Text style={fs.label}>Sleep ended (HH:MM)</Text>
      <TextInput style={fs.input} value={end} onChangeText={setEnd} placeholder="16:00" />
      {error ? <Text style={fs.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[fs.saveBtn, { backgroundColor: TAB_COLORS.sleep }]}
        disabled={saving}
        onPress={() => {
          const s = toIso(start); const e = toIso(end);
          if (!s || !e) { setError('Enter times as HH:MM'); return; }
          if (new Date(e) <= new Date(s)) { setError('End time must be after start time'); return; }
          setError('');
          onSave({ logType: 'sleep', sleepStart: s, sleepEnd: e, sleepPosition: 'back' });
        }}
      >
        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={fs.saveText}>Log sleep</Text>}
      </TouchableOpacity>
    </View>
  );
}

function DiaperForm({ onSave, saving }: { onSave: (p: Record<string, any>) => void; saving: boolean }) {
  const [type, setType] = useState<'wet' | 'dirty' | 'both'>('wet');
  return (
    <View>
      <Text style={fs.label}>Diaper type</Text>
      <View style={fs.chipRow}>
        {([['wet', '💧 Wet'], ['dirty', '💩 Dirty'], ['both', '💧💩 Both']] as const).map(([v, l]) => (
          <TouchableOpacity key={v} style={[fs.chip, type === v && fs.chipActive]} onPress={() => setType(v)}>
            <Text style={[fs.chipText, type === v && fs.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[fs.saveBtn, { backgroundColor: TAB_COLORS.diaper }]}
        disabled={saving}
        onPress={() => onSave({ logType: 'diaper', diaperType: type })}
      >
        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={fs.saveText}>Log diaper</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function NewbornTracker() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const params   = useLocalSearchParams<{ tab?: string }>();
  const { logs, todaySummary, logStatus, profile, active } = useAppSelector((s) => s.postpartum);

  const [tab, setTab] = useState<Tab>(
    (['feeding', 'sleep', 'diaper'].includes(params.tab ?? '') ? params.tab : 'feeding') as Tab
  );
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!active) return;
    dispatch(loadNewbornLogs());
    dispatch(loadTodaySummary());
  }, [dispatch, active]);

  const onSave = async (payload: Record<string, any>) => {
    const result = await dispatch(logNewborn(payload));
    if (logNewborn.fulfilled.match(result)) {
      setShowForm(false);
      dispatch(loadTodaySummary());
    }
  };

  if (!active) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FDF8F2' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🍼</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#4A3728', textAlign: 'center', marginBottom: 8 }}>
          Newborn Tracker
        </Text>
        <Text style={{ fontSize: 14, color: '#A8997F', textAlign: 'center', lineHeight: 22 }}>
          This section unlocks after you activate postpartum mode. Complete your birth details on the home screen to get started.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#CC6E9A', borderRadius: 24 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabLogs = useMemo(
    () => logs.filter((l) => l.log_type === tab).slice(0, 20),
    [logs, tab]
  );

  const describeLog = (l: NewbornLog): string => {
    if (l.log_type === 'feeding') {
      if (l.feeding_type?.startsWith('breast') || l.feeding_type === 'both_breasts') {
        const side = l.feeding_type === 'breast_left' ? 'Left' : l.feeding_type === 'breast_right' ? 'Right' : 'Both';
        return `🤱 ${side}${l.feeding_duration_min ? ` · ${l.feeding_duration_min} min` : ''}`;
      }
      return `🍼 Bottle${l.feeding_amount_ml ? ` · ${l.feeding_amount_ml} ml` : ''}`;
    }
    if (l.log_type === 'sleep') {
      const dur = l.sleep_duration_min;
      return `😴 ${dur ? `${Math.floor(dur / 60)}h ${dur % 60}m` : 'Sleep'}`;
    }
    return `🧷 ${l.diaper_type === 'both' ? 'Wet + dirty' : (l.diaper_type ?? 'Diaper')}`;
  };

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{profile?.baby_name || 'Newborn'} Tracker</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Today summary */}
        {todaySummary && (
          <View style={s.summaryRow}>
            <View style={[s.summaryCard, { borderColor: TAB_COLORS.feeding }]}>
              <Text style={s.summaryNum}>{todaySummary.feeds.count}</Text>
              <Text style={s.summaryLabel}>feeds today</Text>
              {todaySummary.feeds.totalMl > 0 && <Text style={s.summarySub}>{todaySummary.feeds.totalMl} ml</Text>}
              {todaySummary.feeds.totalMinutes > 0 && <Text style={s.summarySub}>{todaySummary.feeds.totalMinutes} min</Text>}
            </View>
            <View style={[s.summaryCard, { borderColor: TAB_COLORS.sleep }]}>
              <Text style={s.summaryNum}>{todaySummary.sleep.totalHours}h</Text>
              <Text style={s.summaryLabel}>sleep today</Text>
              <Text style={s.summarySub}>{todaySummary.sleep.napCount} session{todaySummary.sleep.napCount === 1 ? '' : 's'}</Text>
            </View>
            <View style={[s.summaryCard, { borderColor: TAB_COLORS.diaper }]}>
              <Text style={s.summaryNum}>{todaySummary.diapers.total}</Text>
              <Text style={s.summaryLabel}>diapers</Text>
              <Text style={s.summarySub}>{todaySummary.diapers.wet}💧 {todaySummary.diapers.dirty}💩</Text>
            </View>
          </View>
        )}

        {/* 24h timeline */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Last 24 hours</Text>
          <View style={s.legendRow}>
            {TABS.map((t) => (
              <View key={t.key} style={s.legend}>
                <View style={[s.legendDot, { backgroundColor: TAB_COLORS[t.key] }]} />
                <Text style={s.legendText}>{t.label}</Text>
              </View>
            ))}
          </View>
          <TimelineChart logs={logs} />
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, tab === t.key && { backgroundColor: TAB_COLORS[t.key] }]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.85}
            >
              <Text style={s.tabEmoji}>{t.emoji}</Text>
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add button */}
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: TAB_COLORS[tab] }]}
          onPress={() => setShowForm(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={s.addBtnText}>Log {TABS.find((t) => t.key === tab)?.label.toLowerCase()}</Text>
        </TouchableOpacity>

        {/* Recent logs for the active tab */}
        {tabLogs.length === 0 ? (
          <Text style={s.empty}>No {tab} logs yet today.</Text>
        ) : tabLogs.map((l) => (
          <View key={l.id} style={s.logRow}>
            <Text style={s.logDesc}>{describeLog(l)}</Text>
            <Text style={s.logTime}>
              {new Date(l.logged_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Log form modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.modalBackdrop} onPress={() => setShowForm(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>
              {TABS.find((t) => t.key === tab)?.emoji} Log {TABS.find((t) => t.key === tab)?.label}
            </Text>
            {tab === 'feeding' && <FeedForm onSave={onSave} saving={logStatus === 'saving'} />}
            {tab === 'sleep'   && <SleepForm onSave={onSave} saving={logStatus === 'saving'} />}
            {tab === 'diaper'  && <DiaperForm onSave={onSave} saving={logStatus === 'saving'} />}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#FDF0F8' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#3D1440' },
  content:     { padding: 20, paddingTop: 8 },

  summaryRow:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFDF9', borderRadius: 14, padding: 12, alignItems: 'center', borderTopWidth: 3 },
  summaryNum:  { fontSize: 22, fontWeight: '900', color: '#3D1440' },
  summaryLabel:{ fontSize: 11, color: '#A8997F', marginTop: 2 },
  summarySub:  { fontSize: 10, color: '#C8B8A2', marginTop: 2 },

  chartCard:   { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 16, marginBottom: 16 },
  chartTitle:  { fontSize: 14, fontWeight: '800', color: '#3D1440', marginBottom: 8 },
  legendRow:   { flexDirection: 'row', gap: 14, marginBottom: 8 },
  legend:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 11, color: '#A8997F' },

  tabRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab:         { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#FFFDF9', borderRadius: 12, paddingVertical: 11 },
  tabEmoji:    { fontSize: 15 },
  tabText:     { fontSize: 13, fontWeight: '700', color: '#5A4636' },
  tabTextActive: { color: '#FFFFFF' },

  addBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  addBtnText:  { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  empty:       { textAlign: 'center', color: '#A8997F', marginTop: 16 },
  logRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFDF9', borderRadius: 12, padding: 14, marginBottom: 8 },
  logDesc:     { fontSize: 14, color: '#3D1440', fontWeight: '600' },
  logTime:     { fontSize: 12, color: '#A8997F' },

  modalWrap:   { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(61,20,64,0.35)' },
  modalSheet:  { backgroundColor: '#FFFDF9', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD5C4', alignSelf: 'center', marginBottom: 16 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: '#3D1440', marginBottom: 16 },
});

const fs = StyleSheet.create({
  toggleRow:   { flexDirection: 'row', gap: 8, marginBottom: 8 },
  toggle:      { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: '#FDF0F8', borderWidth: 1.5, borderColor: '#EEE5D8' },
  toggleActive: { backgroundColor: '#CC6E9A', borderColor: '#CC6E9A' },
  toggleText:  { fontSize: 14, fontWeight: '700', color: '#5A4636' },
  toggleTextActive: { color: '#FFFFFF' },

  label:       { fontSize: 13, fontWeight: '700', color: '#3D1440', marginTop: 14, marginBottom: 6 },
  input:       { backgroundColor: '#FDF0F8', borderRadius: 12, padding: 14, fontSize: 15, color: '#3D1440', borderWidth: 1, borderColor: '#EEE5D8' },

  chipRow:     { flexDirection: 'row', gap: 8 },
  chip:        { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#FDF0F8', borderWidth: 1.5, borderColor: '#EEE5D8' },
  chipActive:  { backgroundColor: '#CC6E9A', borderColor: '#CC6E9A' },
  chipText:    { fontSize: 13, fontWeight: '600', color: '#5A4636' },
  chipTextActive: { color: '#FFFFFF' },

  error:       { color: '#C0524A', marginTop: 10 },
  saveBtn:     { backgroundColor: '#CC6E9A', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  saveText:    { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
