// app/(tabs)/plan.tsx
// Planner — 4 tabs: Checklist | Appointments | Birth Plan | Baby Names

import React, {
  useCallback, useEffect, useRef, useState, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  TextInput, Modal, Animated, ActivityIndicator, Share, Alert,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchChecklist, toggleItem, addCustomItem,
  fetchAppointments, createAppointment, completeAppointment, deleteAppointment,
  generateBirthPlan, clearBirthPlan,
  fetchSuggestedNames, fetchShortlist, shortlistName, updateNameStatus,
  type ChecklistItem, type AppointmentEntry, type SuggestedName, type ShortlistedName,
} from '../../store/plannerSlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TAB_LABELS = ['Checklist', 'Calendar', 'Birth Plan', 'Names'];
const TAB_ICONS: [string, string, string, string] = [
  'checkbox-outline', 'calendar-outline', 'document-text-outline', 'heart-outline',
];

function PlanTabBar({
  active, onSelect,
}: { active: number; onSelect: (i: number) => void }) {
  return (
    <View style={styles.tabBar}>
      {TAB_LABELS.map((label, i) => (
        <TouchableOpacity
          key={label}
          style={[styles.tabItem, active === i && styles.tabItemActive]}
          onPress={() => onSelect(i)}
        >
          <Ionicons
            name={TAB_ICONS[i] as any}
            size={16}
            color={active === i ? colors.rose : colors.textMuted}
          />
          <Text style={[styles.tabLabel, active === i && styles.tabLabelActive]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — CHECKLIST
// ═════════════════════════════════════════════════════════════════════════════

const CATEGORY_ICONS: Record<string, string> = {
  'For You': '👩',  'For Mom': '👩', 'For Mum': '👩',
  'For Baby': '👶', 'For Partner': '💪', 'Documents': '📋',
  'Tech': '📱', 'Toiletries': '🧴', 'Comfort': '🌸',
};

function ChecklistItemRow({
  item, categoryName,
}: { item: ChecklistItem; categoryName: string }) {
  const dispatch = useAppDispatch();
  const scale = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, tension: 300 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    dispatch(toggleItem({ categoryName, itemId: item.id }));
  };

  return (
    <TouchableOpacity style={styles.checkItem} onPress={handleToggle} activeOpacity={0.7}>
      <Animated.View style={[
        styles.checkbox,
        item.checked && styles.checkboxChecked,
        { transform: [{ scale }] },
      ]}>
        {item.checked && <Ionicons name="checkmark" size={13} color={colors.white} />}
      </Animated.View>
      <View style={styles.checkItemText}>
        <Text style={[styles.checkItemLabel, item.checked && styles.checkItemChecked]}>
          {item.item}
        </Text>
        {item.note && !item.checked && (
          <Text style={styles.checkItemNote}>{item.note}</Text>
        )}
      </View>
      {item.essential && !item.checked && (
        <View style={styles.essentialBadge}>
          <Text style={styles.essentialText}>Essential</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ChecklistTab() {
  const dispatch = useAppDispatch();
  const { checklistCategories, checklistStatus } = useAppSelector((s) => s.planner);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customItem, setCustomItem] = useState('');
  const [customCat, setCustomCat] = useState('');

  useEffect(() => {
    if (checklistStatus === 'idle') dispatch(fetchChecklist());
  }, [dispatch, checklistStatus]);

  const totalItems = checklistCategories.reduce((s, c) => s + c.items.length, 0);
  const checkedCount = checklistCategories.reduce(
    (s, c) => s + c.items.filter((i) => i.checked).length, 0
  );
  const itemsLeft = totalItems - checkedCount;

  const handleShare = useCallback(() => {
    const lines = checklistCategories.flatMap((cat) => [
      `\n${cat.name.toUpperCase()}`,
      ...cat.items.map((i) => `${i.checked ? '✓' : '○'} ${i.item}`),
    ]);
    Share.share({
      title: 'My Hospital Bag Checklist — Bloom',
      message: `My Hospital Bag Checklist\n${lines.join('\n')}`,
    });
  }, [checklistCategories]);

  const handleAddItem = useCallback(() => {
    if (!customItem.trim()) return;
    dispatch(addCustomItem({
      categoryName: customCat.trim() || 'My Items',
      item: customItem.trim(),
    }));
    setCustomItem('');
    setCustomCat('');
    setShowAddModal(false);
  }, [customItem, customCat, dispatch]);

  if (checklistStatus === 'loading') {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.rose} />
        <Text style={styles.loadingText}>Building your checklist…</Text>
      </View>
    );
  }

  if (checklistStatus === 'error') {
    return (
      <View style={styles.centred}>
        <Text style={styles.errorText}>Couldn't load checklist</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => dispatch(fetchChecklist())}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {/* Counter + share bar */}
      <View style={styles.checklistHeader}>
        <View>
          <Text style={styles.checklistCounter}>
            {itemsLeft === 0 ? '🎉 All packed!' : `${itemsLeft} item${itemsLeft !== 1 ? 's' : ''} left`}
          </Text>
          {totalItems > 0 && (
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                { width: `${Math.round((checkedCount / totalItems) * 100)}%` as any },
              ]} />
            </View>
          )}
        </View>
        <View style={styles.checklistActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={22} color={colors.rose} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.tabContent}>
        {checklistCategories.map((cat) => (
          <View key={cat.name} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryIcon}>
                {CATEGORY_ICONS[cat.name] ?? '📦'}
              </Text>
              <Text style={styles.categoryName}>{cat.name}</Text>
              <Text style={styles.categoryCount}>
                {cat.items.filter((i) => i.checked).length}/{cat.items.length}
              </Text>
            </View>
            {cat.items.map((item) => (
              <ChecklistItemRow key={item.id} item={item} categoryName={cat.name} />
            ))}
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add item modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add item</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Item name"
              placeholderTextColor={colors.textLight}
              value={customItem}
              onChangeText={setCustomItem}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Category (e.g. For Baby)"
              placeholderTextColor={colors.textLight}
              value={customCat}
              onChangeText={setCustomCat}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={handleAddItem}>
                <Text style={styles.modalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — APPOINTMENTS
// ═════════════════════════════════════════════════════════════════════════════

const APPT_TYPES = [
  { value: 'midwife',       label: 'Midwife',       icon: '👩‍⚕️', color: colors.rose },
  { value: 'ultrasound',    label: 'Scan',          icon: '🔬', color: colors.lavender },
  { value: 'blood_test',    label: 'Blood test',    icon: '🩸', color: '#C97B63' },
  { value: 'glucose_test',  label: 'Glucose test',  icon: '🍬', color: colors.success },
  { value: 'obgyn',         label: 'OB/GYN',        icon: '🏥', color: colors.lavenderDark },
  { value: 'anatomy_scan',  label: 'Anatomy scan',  icon: '👶', color: colors.lavenderMid },
  { value: 'general',       label: 'Other',         icon: '📅', color: colors.textMuted },
];

// Appointment suggestions keyed by week range
const APPT_SUGGESTIONS: { minWeek: number; maxWeek: number; title: string; type: string }[] = [
  { minWeek: 6,  maxWeek: 10, title: 'Book your first midwife appointment', type: 'midwife' },
  { minWeek: 10, maxWeek: 14, title: '12-week dating / NT scan', type: 'ultrasound' },
  { minWeek: 14, maxWeek: 18, title: 'Midwife check-up (16 weeks)', type: 'midwife' },
  { minWeek: 18, maxWeek: 22, title: '20-week anatomy scan', type: 'anatomy_scan' },
  { minWeek: 24, maxWeek: 29, title: 'Glucose challenge / screening test', type: 'glucose_test' },
  { minWeek: 27, maxWeek: 30, title: 'Blood tests — iron & antibody check', type: 'blood_test' },
  { minWeek: 30, maxWeek: 35, title: 'Midwife appointment', type: 'midwife' },
  { minWeek: 35, maxWeek: 40, title: 'Group B Strep test (if applicable)', type: 'general' },
];

const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function ApptCard({
  appt,
  onComplete,
  onDelete,
}: { appt: AppointmentEntry; onComplete: () => void; onDelete: () => void }) {
  const typeInfo = APPT_TYPES.find((t) => t.value === appt.type) ?? APPT_TYPES[6];
  const isPast = new Date(appt.scheduled_at) < new Date();
  const isCompleted = appt.status === 'completed';

  return (
    <View style={[styles.apptCard, isCompleted && styles.apptCardDone]}>
      <View style={[styles.apptTypeChip, { backgroundColor: typeInfo.color + '20' }]}>
        <Text style={styles.apptTypeIcon}>{typeInfo.icon}</Text>
      </View>
      <View style={styles.apptInfo}>
        <Text style={[styles.apptTitle, isCompleted && styles.apptTitleDone]}>{appt.title}</Text>
        <Text style={styles.apptDate}>{formatDateTime(appt.scheduled_at)}</Text>
        {appt.location_name && (
          <Text style={styles.apptLocation}>📍 {appt.location_name}</Text>
        )}
      </View>
      <View style={styles.apptActions}>
        {isPast && !isCompleted && (
          <TouchableOpacity onPress={onComplete} style={styles.apptActionBtn}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDelete} style={styles.apptActionBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AppointmentsTab() {
  const dispatch = useAppDispatch();
  const { appointments, appointmentsStatus } = useAppSelector((s) => s.planner);
  const { profile } = useAppSelector((s) => s.profile);
  const currentWeek = profile?.currentWeek ?? 0;

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<number | null>(today.getDate());
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('midwife');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (appointmentsStatus === 'idle') dispatch(fetchAppointments());
  }, [dispatch, appointmentsStatus]);

  const calDays = useMemo(() => buildCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const apptsByDate = useMemo(() => {
    const map: Record<string, AppointmentEntry[]> = {};
    appointments.forEach((a) => {
      const d = new Date(a.scheduled_at);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const key = String(d.getDate());
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    });
    return map;
  }, [appointments, calYear, calMonth]);

  const selectedAppts = selectedDate ? (apptsByDate[String(selectedDate)] ?? []) : [];

  const relevantSuggestions = APPT_SUGGESTIONS.filter(
    (s) => currentWeek >= s.minWeek && currentWeek <= s.maxWeek
  );

  const handleAddAppt = useCallback(async () => {
    if (!formTitle.trim() || !formDate.trim()) return;
    const iso = `${formDate}T${formTime}:00.000Z`;
    await dispatch(createAppointment({
      title: formTitle,
      type: formType,
      scheduledAt: iso,
      locationName: formLocation || undefined,
      notes: formNotes || undefined,
    }));
    setShowAddModal(false);
    setFormTitle('');
    setFormDate('');
    setFormTime('09:00');
    setFormLocation('');
    setFormNotes('');
    dispatch(fetchAppointments());
  }, [formTitle, formType, formDate, formTime, formLocation, formNotes, dispatch]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.tabContent}>
        {/* Calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calNavRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.textBody} />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              {MONTH_NAMES[calMonth]} {calYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.textBody} />
            </TouchableOpacity>
          </View>
          {/* Day letter headers */}
          <View style={styles.calDayHeaders}>
            {DAY_LETTERS.map((l) => (
              <Text key={l} style={styles.calDayHeader}>{l}</Text>
            ))}
          </View>
          {/* Calendar grid */}
          <View style={styles.calGrid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={`empty_${idx}`} style={styles.calCell} />;
              const isToday =
                day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
              const hasAppt = !!apptsByDate[String(day)];
              const isSelected = day === selectedDate;
              return (
                <TouchableOpacity
                  key={`day_${day}`}
                  style={[
                    styles.calCell,
                    isSelected && styles.calCellSelected,
                    isToday && !isSelected && styles.calCellToday,
                  ]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[
                    styles.calDayNum,
                    isSelected && styles.calDayNumSelected,
                    isToday && !isSelected && styles.calDayNumToday,
                  ]}>
                    {day}
                  </Text>
                  {hasAppt && (
                    <View style={[
                      styles.calDot,
                      isSelected && styles.calDotSelected,
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected day appointments */}
        {selectedDate && selectedAppts.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>
              {selectedDate} {MONTH_NAMES[calMonth]}
            </Text>
            {selectedAppts.map((a) => (
              <ApptCard
                key={a.id}
                appt={a}
                onComplete={() => dispatch(completeAppointment(a.id))}
                onDelete={() =>
                  Alert.alert('Delete appointment?', a.title, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteAppointment(a.id)) },
                  ])
                }
              />
            ))}
          </View>
        )}

        {/* All upcoming */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Upcoming</Text>
          {appointments
            .filter((a) => new Date(a.scheduled_at) >= today && a.status !== 'cancelled')
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
            .slice(0, 10)
            .map((a) => (
              <ApptCard
                key={a.id}
                appt={a}
                onComplete={() => dispatch(completeAppointment(a.id))}
                onDelete={() =>
                  Alert.alert('Delete appointment?', a.title, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteAppointment(a.id)) },
                  ])
                }
              />
            ))}
          {appointments.filter((a) => new Date(a.scheduled_at) >= today).length === 0 && (
            <Text style={styles.emptyStateText}>No upcoming appointments</Text>
          )}
        </View>

        {/* Suggested based on week */}
        {relevantSuggestions.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Suggested for week {currentWeek}</Text>
            {relevantSuggestions.map((s) => {
              const typeInfo = APPT_TYPES.find((t) => t.value === s.type) ?? APPT_TYPES[6];
              return (
                <TouchableOpacity
                  key={s.title}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setFormTitle(s.title);
                    setFormType(s.type);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.suggestionIcon}>{typeInfo.icon}</Text>
                  <View style={styles.suggestionText}>
                    <Text style={styles.suggestionTitle}>{s.title}</Text>
                    <Text style={styles.suggestionHint}>Typically around now — schedule it?</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={colors.rose} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setFormTitle(''); setShowAddModal(true); }}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Add appointment modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add appointment</Text>

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 20-week scan"
                placeholderTextColor={colors.textLight}
                value={formTitle}
                onChangeText={setFormTitle}
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {APPT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeChip, formType === t.value && styles.typeChipActive]}
                    onPress={() => setFormType(t.value)}
                  >
                    <Text style={styles.typeChipIcon}>{t.icon}</Text>
                    <Text style={[styles.typeChipLabel, formType === t.value && styles.typeChipLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="2025-08-15"
                placeholderTextColor={colors.textLight}
                value={formDate}
                onChangeText={setFormDate}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>Time (HH:MM)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="09:30"
                placeholderTextColor={colors.textLight}
                value={formTime}
                onChangeText={setFormTime}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>Location (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Hospital name or address"
                placeholderTextColor={colors.textLight}
                value={formLocation}
                onChangeText={setFormLocation}
              />

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 72 }]}
                placeholder="Questions to ask, preparation notes…"
                placeholderTextColor={colors.textLight}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.reminderNote}>
                🔔 Reminders set for 1 day and 1 hour before
              </Text>

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtn} onPress={handleAddAppt}>
                  <Text style={styles.modalBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — BIRTH PLAN
// ═════════════════════════════════════════════════════════════════════════════

const BIRTH_PLAN_QUESTIONS: {
  key: string;
  question: string;
  options: string[];
  allowCustom?: boolean;
}[] = [
  {
    key: 'birthLocation',
    question: 'Where do you plan to give birth?',
    options: ['Hospital', 'Birth centre', 'Home birth', 'Undecided'],
  },
  {
    key: 'supportPerson',
    question: 'Who will be with you?',
    options: ['My partner', 'Partner + family', 'Just me', 'Doula', 'Partner + doula'],
    allowCustom: true,
  },
  {
    key: 'painRelief',
    question: 'Pain relief preferences?',
    options: ['Epidural', 'Gas and air', 'Birthing pool', 'Hypnobirthing', 'TENS machine', 'No pain relief', 'Open to anything'],
    allowCustom: true,
  },
  {
    key: 'positions',
    question: 'Positions you\'d like to try?',
    options: ['Upright / walking', 'Birthing pool', 'On all fours', 'Squatting', 'Lying down', 'Whatever feels right'],
  },
  {
    key: 'interventions',
    question: 'Preferences about interventions?',
    options: ['Minimal interventions', 'Open to whatever is needed', 'Discuss each one with me first', 'No strong preference'],
  },
  {
    key: 'cordClamping',
    question: 'Cord clamping preference?',
    options: ['Delayed cord clamping (at least 1 min)', 'Immediate clamping is fine', 'No preference'],
  },
  {
    key: 'skinToSkin',
    question: 'Skin-to-skin immediately after birth?',
    options: ['Yes — very important to me', 'Yes, if possible', 'I\'m not sure yet', 'No preference'],
  },
  {
    key: 'feedingPlan',
    question: 'Feeding plan?',
    options: ['Breastfeeding', 'Formula feeding', 'Combination', 'Undecided — open to advice'],
  },
];

function BirthPlanTab() {
  const dispatch = useAppDispatch();
  const { birthPlanResult, birthPlanStatus } = useAppSelector((s) => s.planner);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState('');
  const stepAnim = useRef(new Animated.Value(0)).current;

  const animateStep = useCallback(() => {
    stepAnim.setValue(0);
    Animated.spring(stepAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }).start();
  }, [stepAnim]);

  const selectOption = (opt: string) => {
    setAnswers((prev) => ({ ...prev, [BIRTH_PLAN_QUESTIONS[step].key]: opt }));
    setCustomText('');
  };

  const goNext = () => {
    if (step < BIRTH_PLAN_QUESTIONS.length - 1) {
      setStep((s) => s + 1);
      animateStep();
    }
  };

  const goBack = () => {
    if (step > 0) { setStep((s) => s - 1); animateStep(); }
  };

  const allAnswered = BIRTH_PLAN_QUESTIONS.every((q) => answers[q.key]);

  const handleGenerate = () => {
    dispatch(generateBirthPlan(answers));
  };

  const handleShare = () => {
    if (!birthPlanResult) return;
    const sections = Object.entries(birthPlanResult).map(
      ([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
    );
    Share.share({
      title: 'My Birth Plan — Bloom',
      message: `My Birth Plan\n\n${sections.join('\n\n')}`,
    });
  };

  // Plan result view
  if (birthPlanStatus === 'done' && birthPlanResult) {
    const planText: string =
      typeof birthPlanResult === 'string'
        ? birthPlanResult
        : birthPlanResult.plan ?? birthPlanResult.text ?? JSON.stringify(birthPlanResult, null, 2);

    const sections: { title: string; content: string }[] = (() => {
      if (Array.isArray(birthPlanResult.sections)) return birthPlanResult.sections;
      if (typeof birthPlanResult === 'object') {
        return Object.entries(birthPlanResult).map(([k, v]) => ({
          title: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          content: typeof v === 'object' ? JSON.stringify(v) : String(v),
        }));
      }
      return [{ title: 'My Birth Plan', content: planText }];
    })();

    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        <View style={styles.birthPlanDoc}>
          <View style={styles.birthPlanHeader}>
            <Text style={styles.birthPlanTitle}>My Birth Plan 🌸</Text>
            <Text style={styles.birthPlanSubtitle}>
              Created with Bloom — share this with your midwife
            </Text>
          </View>
          {sections.map((s, i) => (
            <View key={i} style={styles.birthPlanSection}>
              <Text style={styles.birthPlanSectionTitle}>{s.title}</Text>
              <Text style={styles.birthPlanSectionText}>{s.content}</Text>
            </View>
          ))}
          <View style={styles.birthPlanDisclaimer}>
            <Text style={styles.birthPlanDisclaimerText}>
              This plan reflects your preferences at this time. Your healthcare team will support
              you in making decisions based on what's safest for you and your baby during labour.
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>Share birth plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.secondaryBtn]}
          onPress={() => dispatch(clearBirthPlan())}
        >
          <Text style={styles.secondaryBtnText}>Start over</Text>
        </TouchableOpacity>
        <View style={{ height: 80 }} />
      </ScrollView>
    );
  }

  // Generating state
  if (birthPlanStatus === 'generating') {
    return (
      <View style={styles.centred}>
        <ActivityIndicator size="large" color={colors.rose} />
        <Text style={styles.loadingText}>Creating your personalised birth plan…</Text>
        <Text style={styles.loadingSubText}>This takes about 15 seconds</Text>
      </View>
    );
  }

  const q = BIRTH_PLAN_QUESTIONS[step];

  return (
    <View style={{ flex: 1 }}>
      {/* Progress dots */}
      <View style={styles.wizardProgress}>
        {BIRTH_PLAN_QUESTIONS.map((_, i) => (
          <View key={i} style={[
            styles.progressDot,
            i <= step && styles.progressDotActive,
            answers[BIRTH_PLAN_QUESTIONS[i].key] && i < step && styles.progressDotDone,
          ]} />
        ))}
        <Text style={styles.wizardStepLabel}>{step + 1} of {BIRTH_PLAN_QUESTIONS.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.wizardContent}>
        <Animated.View style={{
          opacity: stepAnim.interpolate ? stepAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) : 1,
          transform: [{
            translateX: stepAnim.interpolate
              ? stepAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] })
              : 0,
          }],
        }}>
          <Text style={styles.wizardQuestion}>{q.question}</Text>

          {q.options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.wizardOption,
                answers[q.key] === opt && styles.wizardOptionSelected,
              ]}
              onPress={() => selectOption(opt)}
            >
              <Text style={[
                styles.wizardOptionText,
                answers[q.key] === opt && styles.wizardOptionTextSelected,
              ]}>
                {opt}
              </Text>
              {answers[q.key] === opt && (
                <Ionicons name="checkmark-circle" size={18} color={colors.rose} />
              )}
            </TouchableOpacity>
          ))}

          {q.allowCustom && (
            <TextInput
              style={[styles.wizardCustomInput, customText && styles.wizardCustomInputActive]}
              placeholder="Or type your own…"
              placeholderTextColor={colors.textLight}
              value={customText}
              onChangeText={(t) => {
                setCustomText(t);
                if (t) setAnswers((prev) => ({ ...prev, [q.key]: t }));
              }}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Wizard navigation */}
      <View style={styles.wizardNav}>
        <TouchableOpacity
          style={[styles.wizardNavBtn, step === 0 && { opacity: 0.3 }]}
          onPress={goBack}
          disabled={step === 0}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          <Text style={styles.wizardNavBtnText}>Back</Text>
        </TouchableOpacity>

        {step < BIRTH_PLAN_QUESTIONS.length - 1 ? (
          <TouchableOpacity
            style={[styles.wizardNavBtnNext, !answers[q.key] && { opacity: 0.4 }]}
            onPress={goNext}
            disabled={!answers[q.key]}
          >
            <Text style={styles.wizardNavBtnNextText}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.wizardNavBtnNext, !allAnswered && { opacity: 0.4 }]}
            onPress={handleGenerate}
            disabled={!allAnswered}
          >
            <Text style={styles.wizardNavBtnNextText}>Generate plan ✨</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — BABY NAMES
// ═════════════════════════════════════════════════════════════════════════════

const GENDER_FILTERS = ['Any', 'Boy', 'Girl', 'Neutral'];
const STYLE_FILTERS = ['Any', 'Classic', 'Modern', 'Unique', 'Nature'];
const STATUS_ICONS: Record<string, string> = {
  loved: '❤️', maybe: '🤔', vetoed: '❌', saved: '💾',
};

function NameCard({
  name,
  isShortlisted,
  onShortlist,
}: { name: SuggestedName; isShortlisted: boolean; onShortlist: () => void }) {
  const heartAnim = useRef(new Animated.Value(1)).current;

  const handleHeart = () => {
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.4, useNativeDriver: true, tension: 300 }),
      Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onShortlist();
  };

  return (
    <View style={styles.nameCard}>
      <View style={styles.nameInfo}>
        <Text style={styles.namePrimary}>{name.name}</Text>
        {name.origin && <Text style={styles.nameMeta}>{name.origin}</Text>}
        {name.meaning && <Text style={styles.nameMeaning} numberOfLines={2}>{name.meaning}</Text>}
        {name.syllables && (
          <Text style={styles.nameSyllables}>
            {'● '.repeat(name.syllables).trim()}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={handleHeart} style={styles.heartBtn}>
        <Animated.Text style={[styles.heartIcon, { transform: [{ scale: heartAnim }] }]}>
          {isShortlisted ? '❤️' : '🤍'}
        </Animated.Text>
      </TouchableOpacity>
    </View>
  );
}

function BabyNamesTab() {
  const dispatch = useAppDispatch();
  const { suggestedNames, shortlistedNames, namesStatus, shortlistStatus } =
    useAppSelector((s) => s.planner);

  const [genderFilter, setGenderFilter] = useState('Any');
  const [styleFilter, setStyleFilter] = useState('Any');
  const [originQuery, setOriginQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'suggest' | 'shortlist'>('suggest');
  const [compareA, setCompareA] = useState<ShortlistedName | null>(null);
  const [compareB, setCompareB] = useState<ShortlistedName | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    if (shortlistStatus === 'idle') dispatch(fetchShortlist());
  }, [dispatch, shortlistStatus]);

  const shortlistedSet = useMemo(
    () => new Set(shortlistedNames.map((n) => n.name)),
    [shortlistedNames]
  );

  const handleSuggest = () => {
    dispatch(fetchSuggestedNames({
      gender: genderFilter !== 'Any' ? genderFilter.toLowerCase() : undefined,
      style:  styleFilter !== 'Any' ? styleFilter.toLowerCase() : undefined,
      origin: originQuery.trim() || undefined,
      count:  15,
    }));
  };

  const handleShortlist = (name: SuggestedName) => {
    if (!shortlistedSet.has(name.name)) {
      dispatch(shortlistName(name));
    }
  };

  const handleShare = () => {
    const lines = shortlistedNames
      .filter((n) => n.status !== 'vetoed')
      .map((n) => `• ${n.name}${n.origin ? ` (${n.origin})` : ''}${n.meaning ? ` — ${n.meaning}` : ''}`);
    Share.share({
      title: 'Baby Name Shortlist — Bloom',
      message: `Our baby name shortlist 👶\n\n${lines.join('\n')}`,
    });
  };

  const openCompare = (name: ShortlistedName) => {
    if (!compareA) { setCompareA(name); }
    else if (!compareB && name.id !== compareA.id) { setCompareB(name); setShowCompare(true); }
    else { setCompareA(name); setCompareB(null); }
  };

  return (
    <>
      {/* Section toggle */}
      <View style={styles.namesToggle}>
        <TouchableOpacity
          style={[styles.namesToggleBtn, activeSection === 'suggest' && styles.namesToggleBtnActive]}
          onPress={() => setActiveSection('suggest')}
        >
          <Text style={[styles.namesToggleLabel, activeSection === 'suggest' && styles.namesToggleLabelActive]}>
            Suggest names
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.namesToggleBtn, activeSection === 'shortlist' && styles.namesToggleBtnActive]}
          onPress={() => setActiveSection('shortlist')}
        >
          <Text style={[styles.namesToggleLabel, activeSection === 'shortlist' && styles.namesToggleLabelActive]}>
            My shortlist{shortlistedNames.length > 0 ? ` (${shortlistedNames.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeSection === 'suggest' ? (
        <ScrollView contentContainerStyle={styles.tabContent}>
          {/* Gender filter */}
          <Text style={styles.filterLabel}>Gender</Text>
          <View style={styles.filterRow}>
            {GENDER_FILTERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.filterChip, genderFilter === g && styles.filterChipActive]}
                onPress={() => setGenderFilter(g)}
              >
                <Text style={[styles.filterChipText, genderFilter === g && styles.filterChipTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Style filter */}
          <Text style={styles.filterLabel}>Style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {STYLE_FILTERS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, styleFilter === s && styles.filterChipActive]}
                  onPress={() => setStyleFilter(s)}
                >
                  <Text style={[styles.filterChipText, styleFilter === s && styles.filterChipTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Origin */}
          <Text style={styles.filterLabel}>Origin (optional)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Irish, Arabic, Sanskrit…"
            placeholderTextColor={colors.textLight}
            value={originQuery}
            onChangeText={setOriginQuery}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, namesStatus === 'loading' && { opacity: 0.6 }]}
            onPress={handleSuggest}
            disabled={namesStatus === 'loading'}
          >
            {namesStatus === 'loading' ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>Suggest names for me</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Suggested name cards */}
          {suggestedNames.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>{suggestedNames.length} suggestions</Text>
              {suggestedNames.map((n) => (
                <NameCard
                  key={n.name}
                  name={n}
                  isShortlisted={shortlistedSet.has(n.name)}
                  onShortlist={() => handleShortlist(n)}
                />
              ))}
            </>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.tabContent}>
          {shortlistedNames.length === 0 ? (
            <View style={styles.centredInline}>
              <Text style={styles.emptyStateEmoji}>💛</Text>
              <Text style={styles.emptyStateText}>Your shortlist is empty</Text>
              <Text style={styles.emptyStateHint}>Tap 🤍 on any suggested name to save it here</Text>
            </View>
          ) : (
            <>
              {compareA && (
                <View style={styles.compareBanner}>
                  <Text style={styles.compareBannerText}>
                    Comparing: {compareA.name}{compareB ? ` vs ${compareB.name}` : ' — pick another'}
                  </Text>
                  <TouchableOpacity onPress={() => { setCompareA(null); setCompareB(null); }}>
                    <Ionicons name="close" size={18} color={colors.textBody} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.shortlistActions}>
                <TouchableOpacity style={styles.outlineBtn} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={16} color={colors.rose} />
                  <Text style={styles.outlineBtnText}>Share shortlist</Text>
                </TouchableOpacity>
              </View>

              {shortlistedNames.map((n) => (
                <View key={n.id} style={styles.shortlistCard}>
                  <TouchableOpacity
                    style={styles.shortlistCardMain}
                    onPress={() => openCompare(n)}
                  >
                    <View style={styles.shortlistNameRow}>
                      <Text style={styles.namePrimary}>{n.name}</Text>
                      {n.origin && <Text style={styles.nameMeta}> · {n.origin}</Text>}
                    </View>
                    {n.meaning && (
                      <Text style={styles.nameMeaning} numberOfLines={1}>{n.meaning}</Text>
                    )}
                  </TouchableOpacity>
                  <View style={styles.shortlistVotes}>
                    {(['loved', 'maybe', 'vetoed'] as const).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.voteBtn, n.status === s && styles.voteBtnActive]}
                        onPress={() => dispatch(updateNameStatus({ id: n.id, status: s }))}
                      >
                        <Text style={styles.voteBtnIcon}>{STATUS_ICONS[s]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Compare modal */}
      <Modal visible={showCompare && !!compareA && !!compareB} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.compareCard}>
            <Text style={styles.modalTitle}>Comparing names</Text>
            <View style={styles.compareRow}>
              {[compareA, compareB].filter(Boolean).map((n) => (
                <View key={n!.id} style={styles.compareCol}>
                  <Text style={styles.compareNameTitle}>{n!.name}</Text>
                  {n!.origin && <Text style={styles.compareMeta}>Origin: {n!.origin}</Text>}
                  {n!.pronunciation && <Text style={styles.compareMeta}>Say: {n!.pronunciation}</Text>}
                  {n!.syllables !== undefined && (
                    <Text style={styles.compareMeta}>{n!.syllables} syllable{n!.syllables !== 1 ? 's' : ''}</Text>
                  )}
                  {n!.meaning && <Text style={styles.compareMeaning} numberOfLines={4}>{n!.meaning}</Text>}
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => { setShowCompare(false); setCompareA(null); setCompareB(null); }}
            >
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export default function PlanScreen() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Planner</Text>
      </View>
      <PlanTabBar active={activeTab} onSelect={setActiveTab} />
      <View style={styles.tabBody}>
        {activeTab === 0 && <ChecklistTab />}
        {activeTab === 1 && <AppointmentsTab />}
        {activeTab === 2 && <BirthPlanTab />}
        {activeTab === 3 && <BabyNamesTab />}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textDeep },

  // Tab bar
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 2,
  },
  tabItemActive: { borderBottomColor: colors.rose },
  tabLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },
  tabLabelActive: { color: colors.rose, fontWeight: '700' },
  tabBody: { flex: 1 },

  // Shared
  tabContent: { padding: spacing.md, gap: spacing.sm },
  centred: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  centredInline: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  loadingText: { fontSize: 15, color: colors.textBody, textAlign: 'center' },
  loadingSubText: { fontSize: 12, color: colors.textMuted },
  errorText: { fontSize: 14, color: colors.error },
  retryBtn: { backgroundColor: colors.rose, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  retryBtnText: { color: colors.white, fontWeight: '600' },
  emptyStateEmoji: { fontSize: 36 },
  emptyStateText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  emptyStateHint: { fontSize: 12, color: colors.textLight, textAlign: 'center' },
  sectionBlock: { gap: spacing.xs },
  sectionHeading: { fontSize: 14, fontWeight: '700', color: colors.textDeep, marginTop: spacing.xs },
  iconBtn: { padding: spacing.xs },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xl,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondaryBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  secondaryBtnText: { fontSize: 14, color: colors.textBody, fontWeight: '600' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, alignSelf: 'flex-start',
  },
  outlineBtnText: { color: colors.rose, fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: spacing.lg, right: spacing.md,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },

  // Modal shared
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textDeep },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  modalInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14, color: colors.textBody,
  },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: {
    flex: 1, backgroundColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2, alignItems: 'center',
  },
  modalBtnSecondary: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  modalBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  modalBtnTextSecondary: { color: colors.textBody, fontWeight: '600', fontSize: 14 },

  // ── Checklist
  checklistHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  checklistCounter: { fontSize: 14, fontWeight: '700', color: colors.textDeep },
  progressBar: {
    height: 4, backgroundColor: colors.border, borderRadius: 2, width: 120, marginTop: 4,
  },
  progressFill: { height: '100%', backgroundColor: colors.rose, borderRadius: 2 },
  checklistActions: { flexDirection: 'row', gap: spacing.xs },
  categorySection: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: 'hidden', ...shadow.sm, marginBottom: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  categoryIcon: { fontSize: 18 },
  categoryName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDeep },
  categoryCount: { fontSize: 12, color: colors.textMuted },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.rose, borderColor: colors.rose },
  checkItemText: { flex: 1 },
  checkItemLabel: { fontSize: 14, color: colors.textBody },
  checkItemChecked: { textDecorationLine: 'line-through', color: colors.textLight },
  checkItemNote: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  essentialBadge: {
    backgroundColor: colors.roseLight, borderRadius: radius.pill,
    paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  essentialText: { fontSize: 10, color: colors.rose, fontWeight: '600' },

  // ── Appointments
  calendarCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.sm,
  },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  calNavBtn: { padding: spacing.xs },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: colors.textDeep },
  calDayHeaders: { flexDirection: 'row', marginBottom: spacing.xs },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%` as any, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm,
  },
  calCellSelected: { backgroundColor: colors.rose },
  calCellToday: { backgroundColor: colors.roseLight },
  calDayNum: { fontSize: 13, color: colors.textBody },
  calDayNumSelected: { color: colors.white, fontWeight: '700' },
  calDayNumToday: { color: colors.rose, fontWeight: '700' },
  calDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.rose, marginTop: 2 },
  calDotSelected: { backgroundColor: colors.white },
  apptCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border,
  },
  apptCardDone: { opacity: 0.55 },
  apptTypeChip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  apptTypeIcon: { fontSize: 18 },
  apptInfo: { flex: 1 },
  apptTitle: { fontSize: 14, fontWeight: '600', color: colors.textDeep },
  apptTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  apptDate: { fontSize: 12, color: colors.textMuted },
  apptLocation: { fontSize: 11, color: colors.textMuted },
  apptActions: { flexDirection: 'row', gap: 4 },
  apptActionBtn: { padding: spacing.xs },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfacePink, borderRadius: radius.md,
    padding: spacing.sm + 2, borderWidth: 1, borderColor: colors.border,
  },
  suggestionIcon: { fontSize: 20 },
  suggestionText: { flex: 1 },
  suggestionTitle: { fontSize: 13, fontWeight: '600', color: colors.textDeep },
  suggestionHint: { fontSize: 11, color: colors.textMuted },
  typeScroll: { marginBottom: spacing.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    marginRight: spacing.xs, backgroundColor: colors.bg,
  },
  typeChipActive: { backgroundColor: colors.roseLight, borderColor: colors.rose },
  typeChipIcon: { fontSize: 14 },
  typeChipLabel: { fontSize: 12, color: colors.textBody },
  typeChipLabelActive: { color: colors.rose, fontWeight: '600' },
  reminderNote: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  // ── Birth Plan wizard
  wizardProgress: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: { backgroundColor: colors.roseMid },
  progressDotDone: { backgroundColor: colors.rose },
  wizardStepLabel: { marginLeft: 'auto' as any, fontSize: 12, color: colors.textMuted },
  wizardContent: { padding: spacing.md, paddingBottom: spacing.xl },
  wizardQuestion: {
    fontSize: 20, fontWeight: '700', color: colors.textDeep,
    marginBottom: spacing.lg, lineHeight: 28,
  },
  wizardOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border,
  },
  wizardOptionSelected: { borderColor: colors.rose, backgroundColor: colors.roseLight },
  wizardOptionText: { fontSize: 14, color: colors.textBody, flex: 1 },
  wizardOptionTextSelected: { color: colors.roseDark, fontWeight: '600' },
  wizardCustomInput: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14, color: colors.textBody, marginTop: spacing.xs,
  },
  wizardCustomInputActive: { borderColor: colors.rose },
  wizardNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  wizardNavBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    padding: spacing.sm,
  },
  wizardNavBtnText: { fontSize: 14, color: colors.textBody },
  wizardNavBtnNext: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.rose, borderRadius: radius.pill,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  wizardNavBtnNextText: { fontSize: 14, color: colors.white, fontWeight: '700' },

  // Birth plan document
  birthPlanDoc: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: 'hidden', ...shadow.sm,
  },
  birthPlanHeader: {
    backgroundColor: colors.rose, padding: spacing.lg, alignItems: 'center',
  },
  birthPlanTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  birthPlanSubtitle: { fontSize: 12, color: colors.roseLight, marginTop: 4, textAlign: 'center' },
  birthPlanSection: {
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  birthPlanSectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.rose,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  birthPlanSectionText: { fontSize: 14, color: colors.textBody, lineHeight: 21 },
  birthPlanDisclaimer: {
    backgroundColor: colors.bg, padding: spacing.md,
  },
  birthPlanDisclaimerText: { fontSize: 11, color: colors.textMuted, lineHeight: 17, fontStyle: 'italic', textAlign: 'center' },

  // ── Baby Names
  namesToggle: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  namesToggleBtn: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  namesToggleBtnActive: { borderBottomColor: colors.rose },
  namesToggleLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  namesToggleLabelActive: { color: colors.rose, fontWeight: '700' },
  filterLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs,
    backgroundColor: colors.bg,
  },
  filterChipActive: { backgroundColor: colors.rose, borderColor: colors.rose },
  filterChipText: { fontSize: 13, color: colors.textBody },
  filterChipTextActive: { color: colors.white, fontWeight: '600' },
  nameCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  nameInfo: { flex: 1 },
  namePrimary: { fontSize: 18, fontWeight: '700', color: colors.textDeep },
  nameMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  nameMeaning: { fontSize: 12, color: colors.textBody, marginTop: 3, lineHeight: 17 },
  nameSyllables: { fontSize: 10, color: colors.lavender, marginTop: 3, letterSpacing: 2 },
  heartBtn: { padding: spacing.xs },
  heartIcon: { fontSize: 22 },
  shortlistActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  shortlistCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  shortlistCardMain: { flex: 1, padding: spacing.md },
  shortlistNameRow: { flexDirection: 'row', alignItems: 'baseline' },
  shortlistVotes: {
    flexDirection: 'column', borderLeftWidth: 1, borderLeftColor: colors.borderLight,
    gap: 0,
  },
  voteBtn: { padding: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  voteBtnActive: { backgroundColor: colors.bg },
  voteBtnIcon: { fontSize: 16 },
  compareBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.lavenderLight, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  compareBannerText: { fontSize: 13, color: colors.textBody, flex: 1 },
  compareCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md,
    marginTop: 'auto' as any,
  },
  compareRow: { flexDirection: 'row', gap: spacing.md },
  compareCol: {
    flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  compareNameTitle: { fontSize: 20, fontWeight: '800', color: colors.textDeep },
  compareMeta: { fontSize: 12, color: colors.textMuted },
  compareMeaning: { fontSize: 12, color: colors.textBody, lineHeight: 17, marginTop: 4 },
});
