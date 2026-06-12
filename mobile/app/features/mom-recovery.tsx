// app/features/mom-recovery.tsx
// Mom recovery guide: day-by-day (week 1), week-by-week (1-12), warning signs.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSelector } from '../../store';

// ── Content ─────────────────────────────────────────────────────────────────

const DAY_GUIDE: { day: string; vaginal: string; cSection: string }[] = [
  {
    day: 'Day 1-2',
    vaginal: 'Heavy bleeding (lochia) is normal — bright red with small clots. Rest, hydrate, eat iron-rich food. Your first wee and poo can be daunting; a peri bottle of warm water helps.',
    cSection: 'You\'ll be helped to stand and take first steps — it hurts, but gentle movement prevents clots. Keep pain relief topped up; don\'t wait for pain to peak. The catheter usually comes out within 24h.',
  },
  {
    day: 'Day 3-4',
    vaginal: 'Your milk likely "comes in" — breasts may be engorged and emotional waves ("baby blues") often peak now. Both are hormone-driven and temporary.',
    cSection: 'Milk comes in and baby blues peak, same as any birth. Support your incision with a pillow when coughing, laughing, or feeding. Keep the dressing dry.',
  },
  {
    day: 'Day 5-7',
    vaginal: 'Bleeding turns darker and lighter. Stitches (if any) may itch as they heal — that\'s a good sign. Take naps seriously; your body is doing major repair work.',
    cSection: 'Dressing usually comes off around day 5. Check the incision daily with a mirror — it should look closed and dry. Numbness around the scar is normal and can last months.',
  },
];

const WEEK_GUIDE: { week: number; title: string; body: string }[] = [
  { week: 1,  title: 'Survival week',          body: 'Bleeding, soreness, milk coming in, baby blues. Your only jobs: feed the baby, feed yourself, rest. Accept every offer of help.' },
  { week: 2,  title: 'Finding a rhythm',       body: 'Bleeding lightens to pink/brown. Night sweats are common as hormones reset. If baby blues haven\'t lifted by now, mention it to your midwife or doctor.' },
  { week: 3,  title: 'Turning a corner',       body: 'Energy improves in bursts. C-section: still no lifting or driving. Vaginal: gentle pelvic floor squeezes can start if comfortable.' },
  { week: 4,  title: 'One month in',           body: 'Lochia may stop or be very light. Cluster feeding and a growth spurt often hit around now — it\'s not your supply, it\'s the baby growing.' },
  { week: 6,  title: 'The 6-week check',       body: 'Your postpartum check-up: healing, bleeding, mood, contraception. Be honest about how you actually feel — this appointment is for YOU.' },
  { week: 8,  title: 'Rebuilding',             body: 'If cleared at your check, gentle exercise can resume — walking, postnatal yoga, pelvic-floor-safe workouts. No high impact yet.' },
  { week: 10, title: 'New normal forming',     body: 'Sleep may consolidate slightly. Hair shedding (postpartum telogen effluvium) often starts now — alarming but completely normal.' },
  { week: 12, title: 'Fourth trimester ends',  body: 'Three months! Your recovery continues quietly for up to a year. Diastasis recti check, pelvic floor physio, and mood are all still worth attention.' },
];

const WARNING_SIGNS: { sign: string; detail: string; urgent: boolean }[] = [
  { sign: 'Heavy bleeding', detail: 'Soaking a maternity pad in under an hour, or clots larger than a golf ball — possible postpartum haemorrhage.', urgent: true },
  { sign: 'Fever 38°C+', detail: 'With or without chills — could signal uterine, wound, or breast infection (mastitis).', urgent: true },
  { sign: 'Severe headache + vision changes', detail: 'Especially with swelling — pre-eclampsia can occur AFTER birth.', urgent: true },
  { sign: 'Chest pain or breathlessness', detail: 'Possible blood clot in the lung — call emergency services immediately.', urgent: true },
  { sign: 'Leg pain or one-sided swelling', detail: 'A hot, swollen, painful calf can mean a clot (DVT). Same-day medical review.', urgent: true },
  { sign: 'Wound separation or discharge', detail: 'C-section incision or perineal stitches opening, oozing, or smelling — call your midwife or doctor today.', urgent: false },
  { sign: 'Foul-smelling discharge', detail: 'Lochia should never smell offensive — possible infection.', urgent: false },
  { sign: 'Burning when weeing / can\'t wee', detail: 'Possible urinary infection or retention — call your provider.', urgent: false },
  { sign: 'Feeling hopeless, detached, or having scary thoughts', detail: 'Low mood beyond 2 weeks, not bonding, or any thoughts of harm — you deserve support now, not later. Speak to your doctor or a crisis line today.', urgent: false },
];

// ── Screen ──────────────────────────────────────────────────────────────────

type Section = 'days' | 'weeks' | 'warnings';

export default function MomRecovery() {
  const router  = useRouter();
  const profile = useAppSelector((s) => s.postpartum.profile);
  const [section, setSection] = useState<Section>('days');

  const isCSection = profile?.birth_type === 'c_section';
  const currentWeek = profile?.babyAgeWeeks ?? 0;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#3D1440" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Your Recovery</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Birth type pill */}
      <View style={s.typePill}>
        <Text style={s.typePillText}>
          {isCSection ? '🏥 C-section recovery track' : '🌸 Vaginal birth recovery track'}
        </Text>
      </View>

      {/* Section tabs */}
      <View style={s.tabRow}>
        {([['days', 'First week'], ['weeks', 'Weeks 1-12'], ['warnings', 'Warning signs']] as [Section, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.tab, section === key && s.tabActive]} onPress={() => setSection(key)}>
            <Text style={[s.tabText, section === key && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {section === 'days' && DAY_GUIDE.map((d) => (
          <View key={d.day} style={s.card}>
            <Text style={s.cardDay}>{d.day}</Text>
            <Text style={s.cardText}>{isCSection ? d.cSection : d.vaginal}</Text>
          </View>
        ))}

        {section === 'weeks' && WEEK_GUIDE.map((w) => {
          const isCurrent = currentWeek >= w.week && currentWeek < (WEEK_GUIDE.find((x) => x.week > w.week)?.week ?? 99);
          return (
            <View key={w.week} style={[s.card, isCurrent && s.cardCurrent]}>
              <View style={s.weekHeader}>
                <Text style={s.weekNum}>Week {w.week}</Text>
                {isCurrent && <View style={s.nowBadge}><Text style={s.nowBadgeText}>You are here</Text></View>}
              </View>
              <Text style={s.weekTitle}>{w.title}</Text>
              <Text style={s.cardText}>{w.body}</Text>
            </View>
          );
        })}

        {section === 'warnings' && (
          <>
            <View style={s.urgentBanner}>
              <Ionicons name="warning" size={18} color="#FFFFFF" />
              <Text style={s.urgentBannerText}>
                Red items: call emergency services or go to hospital NOW. Others: contact your midwife or doctor the same day.
              </Text>
            </View>
            {WARNING_SIGNS.map((w) => (
              <View key={w.sign} style={[s.warnCard, w.urgent && s.warnCardUrgent]}>
                <View style={s.warnHeader}>
                  <Text style={[s.warnSign, w.urgent && s.warnSignUrgent]}>{w.sign}</Text>
                  {w.urgent && <Text style={s.warnTag}>EMERGENCY</Text>}
                </View>
                <Text style={s.warnDetail}>{w.detail}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL('tel:999')} activeOpacity={0.85}>
              <Ionicons name="call" size={18} color="#FFFFFF" />
              <Text style={s.callBtnText}>Call emergency services</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#FDF0F8' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#3D1440' },

  typePill:    { alignSelf: 'center', backgroundColor: '#FFFDF9', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 14 },
  typePillText: { fontSize: 12, fontWeight: '700', color: '#CC6E9A' },

  tabRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  tab:         { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFDF9' },
  tabActive:   { backgroundColor: '#CC6E9A' },
  tabText:     { fontSize: 12, fontWeight: '700', color: '#5A4636' },
  tabTextActive: { color: '#FFFFFF' },

  content:     { padding: 20, paddingTop: 4 },
  card:        { backgroundColor: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 12 },
  cardCurrent: { borderWidth: 2, borderColor: '#CC6E9A' },
  cardDay:     { fontSize: 13, fontWeight: '800', color: '#CC6E9A', marginBottom: 6 },
  cardText:    { fontSize: 14, color: '#5A4636', lineHeight: 21 },

  weekHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  weekNum:     { fontSize: 13, fontWeight: '800', color: '#CC6E9A' },
  nowBadge:    { backgroundColor: '#CC6E9A', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  nowBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  weekTitle:   { fontSize: 16, fontWeight: '800', color: '#3D1440', marginBottom: 6 },

  urgentBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#D63B5A', borderRadius: 14, padding: 14, marginBottom: 14 },
  urgentBannerText: { flex: 1, color: '#FFFFFF', fontSize: 12, lineHeight: 17, fontWeight: '600' },

  warnCard:    { backgroundColor: '#FFFDF9', borderRadius: 14, padding: 16, marginBottom: 10 },
  warnCardUrgent: { borderLeftWidth: 4, borderLeftColor: '#D63B5A' },
  warnHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  warnSign:    { fontSize: 14, fontWeight: '800', color: '#3D1440', flex: 1 },
  warnSignUrgent: { color: '#D63B5A' },
  warnTag:     { fontSize: 9, fontWeight: '900', color: '#D63B5A', letterSpacing: 0.5 },
  warnDetail:  { fontSize: 13, color: '#5A4636', lineHeight: 19 },

  callBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D63B5A', borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  callBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
