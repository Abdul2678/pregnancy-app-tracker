// store/trackingSlice.ts
// Tracking state: today's logs, 30-day history dots, weight chart data, AI results.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriageResult {
  severity: 'EMERGENCY' | 'URGENT' | 'CALL_DOCTOR' | 'MONITOR' | 'NORMAL';
  urgentFlag: boolean;
  recommendation: string;
  response?: string;
}

export interface SymptomLog {
  id: string;
  symptoms: string[];
  severity: number;
  note: string;
  logged_at: string;
  triage?: TriageResult;
}

export interface MoodLog {
  id: string;
  mood: string;
  moodScore: number;
  note: string;
  logged_at: string;
  insight?: string;
  consecutiveLowDays?: number;
}

export interface WeightLog {
  id: string;
  weight_kg: number;
  weight_lbs: number;
  logged_at: string;
  guidance?: { status: string; message: string };
}

export interface DayDots {
  date: string;
  hasSymptom: boolean;
  hasMood: boolean;
  hasWeight: boolean;
}

interface TrackingState {
  today: {
    symptoms: SymptomLog[];
    moods:    MoodLog[];
    weights:  WeightLog[];
  };
  historyDots:         DayDots[];
  weightHistory:       WeightLog[];
  weekSummary:         string | null;
  consecutiveLowMoods: number;
  selectedDate:        string | null;
  selectedDayLog: {
    symptoms: SymptomLog[];
    moods:    MoodLog[];
    weights:  WeightLog[];
  } | null;
  status: 'idle' | 'loading' | 'submitting' | 'error';
  error:  string | null;
}

const initialState: TrackingState = {
  today:               { symptoms: [], moods: [], weights: [] },
  historyDots:         [],
  weightHistory:       [],
  weekSummary:         null,
  consecutiveLowMoods: 0,
  selectedDate:        null,
  selectedDayLog:      null,
  status:              'idle',
  error:               null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchTodayLogs = createAsyncThunk('tracking/today', async () => {
  const { data } = await api.get('/tracking/today');
  return (data?.data ?? data) as { symptoms: SymptomLog[]; moods: MoodLog[]; weights: WeightLog[] };
});

export const fetchHistoryDots = createAsyncThunk('tracking/historyDots', async () => {
  const { data } = await api.get('/tracking/history?days=30');
  const payload = data?.data ?? data;
  return (payload?.days ?? payload ?? []) as DayDots[];
});

export const fetchWeightHistory = createAsyncThunk('tracking/weightHistory', async () => {
  const { data } = await api.get('/tracking/weight?limit=8');
  const payload = data?.data ?? data;
  return (payload?.weights ?? payload ?? []) as WeightLog[];
});

export const fetchWeekSummary = createAsyncThunk('tracking/weekSummary', async () => {
  const { data } = await api.get('/tracking/weekly-summary');
  return ((data?.data ?? data)?.summary ?? null) as string | null;
});

export const fetchDayLog = createAsyncThunk('tracking/dayLog', async (date: string) => {
  const { data } = await api.get(`/tracking/day?date=${date}`);
  return (data?.data ?? data) as { symptoms: SymptomLog[]; moods: MoodLog[]; weights: WeightLog[] };
});

export const logSymptom = createAsyncThunk(
  'tracking/logSymptom',
  async (payload: { symptoms: string[]; severity: number; note: string }) => {
    const { data } = await api.post('/tracking/symptoms', payload);
    return (data?.data ?? data) as { log: SymptomLog; triage: TriageResult };
  }
);

export const logMood = createAsyncThunk(
  'tracking/logMood',
  async (payload: { mood: string; moodScore: number; note: string }) => {
    const { data } = await api.post('/tracking/mood', payload);
    return (data?.data ?? data) as { log: MoodLog; insight: string; consecutiveLowDays: number };
  }
);

export const logWeight = createAsyncThunk(
  'tracking/logWeight',
  async (payload: { weight_kg: number; weight_lbs: number }) => {
    const { data } = await api.post('/tracking/weight', payload);
    return (data?.data ?? data) as { log: WeightLog; guidance: { status: string; message: string } };
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const trackingSlice = createSlice({
  name: 'tracking',
  initialState,
  reducers: {
    setSelectedDate(state, action: PayloadAction<string | null>) {
      state.selectedDate = action.payload;
    },
    clearSelectedDay(state) {
      state.selectedDate = null;
      state.selectedDayLog = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodayLogs.fulfilled,    (s, a) => { s.today = a.payload; })
      .addCase(fetchHistoryDots.fulfilled,  (s, a) => { s.historyDots = a.payload; })
      .addCase(fetchWeightHistory.fulfilled,(s, a) => { s.weightHistory = a.payload; })
      .addCase(fetchWeekSummary.fulfilled,  (s, a) => { s.weekSummary = a.payload; })
      .addCase(fetchDayLog.fulfilled,       (s, a) => { s.selectedDayLog = a.payload; })

      .addCase(logSymptom.pending,  (s) => { s.status = 'submitting'; s.error = null; })
      .addCase(logSymptom.fulfilled,(s, a) => {
        s.status = 'idle';
        s.today.symptoms.unshift({ ...a.payload.log, triage: a.payload.triage });
        markDot(s.historyDots, 'symptom');
      })
      .addCase(logSymptom.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message ?? null; })

      .addCase(logMood.pending,  (s) => { s.status = 'submitting'; s.error = null; })
      .addCase(logMood.fulfilled,(s, a) => {
        s.status = 'idle';
        s.today.moods.unshift({ ...a.payload.log, insight: a.payload.insight, consecutiveLowDays: a.payload.consecutiveLowDays });
        s.consecutiveLowMoods = a.payload.consecutiveLowDays ?? 0;
        markDot(s.historyDots, 'mood');
      })
      .addCase(logMood.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message ?? null; })

      .addCase(logWeight.pending,  (s) => { s.status = 'submitting'; s.error = null; })
      .addCase(logWeight.fulfilled,(s, a) => {
        s.status = 'idle';
        const log = { ...a.payload.log, guidance: a.payload.guidance };
        s.today.weights.unshift(log);
        s.weightHistory.unshift(log);
        if (s.weightHistory.length > 8) s.weightHistory.pop();
        markDot(s.historyDots, 'weight');
      })
      .addCase(logWeight.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message ?? null; });
  },
});

function markDot(dots: DayDots[], type: 'symptom' | 'mood' | 'weight') {
  const today = new Date().toISOString().slice(0, 10);
  let dot = dots.find((d) => d.date === today);
  if (!dot) {
    dot = { date: today, hasSymptom: false, hasMood: false, hasWeight: false };
    dots.unshift(dot);
  }
  if (type === 'symptom') dot.hasSymptom = true;
  if (type === 'mood')    dot.hasMood    = true;
  if (type === 'weight')  dot.hasWeight  = true;
}

export const { setSelectedDate, clearSelectedDay } = trackingSlice.actions;
export default trackingSlice.reducer;
