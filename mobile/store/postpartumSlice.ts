// store/postpartumSlice.ts
// Postpartum mode state: profile, newborn logs, today summary, 6-week check-in.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PostpartumProfile {
  id: string;
  birth_date: string;
  birth_type: 'vaginal' | 'c_section' | 'vbac' | 'assisted' | null;
  feeding_method: string;
  baby_name: string | null;
  baby_sex: string | null;
  birth_weight_grams: number | null;
  birth_length_cm: number | null;
  current_baby_week: number;
  babyAgeWeeks: number;
  babyAgeDays: number;
  epdsOverdue?: boolean;
  ppd_high_risk?: boolean;
}

export interface NewbornLog {
  id: string;
  log_type: 'feeding' | 'sleep' | 'diaper' | 'growth' | 'other';
  baby_age_days: number;
  feeding_type?: string | null;
  feeding_duration_min?: number | null;
  feeding_amount_ml?: number | null;
  sleep_start?: string | null;
  sleep_end?: string | null;
  sleep_duration_min?: number | null;
  diaper_type?: string | null;
  stool_color?: string | null;
  weight_grams?: number | null;
  notes?: string | null;
  logged_at: string;
}

export interface TodaySummary {
  date: string;
  feeds:   { count: number; totalMinutes: number; totalMl: number };
  sleep:   { totalMinutes: number; napCount: number; totalHours: number };
  diapers: { total: number; wet: number; dirty: number };
}

interface PostpartumState {
  active: boolean;
  checked: boolean;                 // we've checked once whether pp mode is on
  profile: PostpartumProfile | null;
  todaySummary: TodaySummary | null;
  logs: NewbornLog[];
  weekContent: Record<string, any> | null;
  sixWeekSummary: string | null;
  status: 'idle' | 'loading' | 'submitting' | 'error';
  logStatus: 'idle' | 'saving' | 'error';
  sixWeekStatus: 'idle' | 'generating' | 'error';
  moodGapDays: number | null;       // days since last mood log
}

const initialState: PostpartumState = {
  active: false,
  checked: false,
  profile: null,
  todaySummary: null,
  logs: [],
  weekContent: null,
  sixWeekSummary: null,
  status: 'idle',
  logStatus: 'idle',
  sixWeekStatus: 'idle',
  moodGapDays: null,
};

// ── Thunks ─────────────────────────────────────────────────────────────────

export const loadPostpartumProfile = createAsyncThunk('postpartum/profile', async () => {
  try {
    const { data } = await api.get('/postpartum/profile');
    return (data?.data ?? data) as PostpartumProfile;
  } catch {
    return null; // 404 = not activated
  }
});

export const activatePostpartum = createAsyncThunk(
  'postpartum/activate',
  async (payload: {
    birthDate: string;
    birthType?: 'vaginal' | 'c_section' | 'vbac' | 'assisted';
    feedingMethod?: string;
    babyName?: string | null;
    babySex?: string;
    birthWeightGrams?: number | null;
    birthLengthCm?: number | null;
    complications?: string | null;
  }) => {
    const { complications, ...body } = payload;
    const { data } = await api.post('/postpartum/activate', body);
    const result = data?.data ?? data;
    // Complications noted via profile notes if provided (best-effort)
    return result?.postpartumProfile
      ? { ...result.postpartumProfile, babyAgeWeeks: result.babyAgeWeeks, babyAgeDays: result.babyAgeDays }
      : result;
  }
);

export const logNewborn = createAsyncThunk(
  'postpartum/log',
  async (payload: Record<string, any>) => {
    const { data } = await api.post('/postpartum/logs', payload);
    return (data?.data ?? data)?.log as NewbornLog;
  }
);

export const loadTodaySummary = createAsyncThunk('postpartum/summary', async () => {
  const { data } = await api.get('/postpartum/logs/summary');
  return (data?.data ?? data) as TodaySummary;
});

export const loadNewbornLogs = createAsyncThunk(
  'postpartum/logs',
  async (logType?: string) => {
    const { data } = await api.get(`/postpartum/logs?limit=100${logType ? `&logType=${logType}` : ''}`);
    return ((data?.data ?? data)?.logs ?? []) as NewbornLog[];
  }
);

export const loadNewbornWeek = createAsyncThunk(
  'postpartum/weekContent',
  async (week: number) => {
    const { data } = await api.get(`/postpartum/newborn-week/${week}`);
    return (data?.data ?? data)?.content ?? null;
  }
);

export const generateSixWeekSummary = createAsyncThunk('postpartum/sixWeek', async () => {
  const { data } = await api.post('/postpartum/six-week-summary');
  return (data?.data ?? data)?.summary as string;
});

export const checkMoodGap = createAsyncThunk('postpartum/moodGap', async () => {
  try {
    const { data } = await api.get('/tracking/mood?limit=1');
    const payload = data?.data ?? data;
    const last = (payload?.moods ?? payload?.logs ?? payload ?? [])[0];
    if (!last?.logged_at) return 999;
    return Math.floor((Date.now() - new Date(last.logged_at).getTime()) / 86400000);
  } catch {
    return null;
  }
});

// ── Slice ──────────────────────────────────────────────────────────────────

const postpartumSlice = createSlice({
  name: 'postpartum',
  initialState,
  reducers: {
    clearSixWeekSummary(state) {
      state.sixWeekSummary = null;
      state.sixWeekStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPostpartumProfile.pending, (s) => { s.status = 'loading'; })
      .addCase(loadPostpartumProfile.fulfilled, (s, a) => {
        s.status = 'idle';
        s.checked = true;
        if (a.payload) { s.active = true; s.profile = a.payload; }
        else { s.active = false; }
      })
      .addCase(loadPostpartumProfile.rejected, (s) => { s.status = 'idle'; s.checked = true; })

      .addCase(activatePostpartum.pending, (s) => { s.status = 'submitting'; })
      .addCase(activatePostpartum.fulfilled, (s, a) => {
        s.status = 'idle';
        s.active = true;
        s.profile = a.payload;
      })
      .addCase(activatePostpartum.rejected, (s) => { s.status = 'error'; })

      .addCase(logNewborn.pending, (s) => { s.logStatus = 'saving'; })
      .addCase(logNewborn.fulfilled, (s, a) => {
        s.logStatus = 'idle';
        if (a.payload) s.logs.unshift(a.payload);
      })
      .addCase(logNewborn.rejected, (s) => { s.logStatus = 'error'; })

      .addCase(loadTodaySummary.fulfilled, (s, a) => { s.todaySummary = a.payload; })
      .addCase(loadNewbornLogs.fulfilled, (s, a) => { s.logs = a.payload; })
      .addCase(loadNewbornWeek.fulfilled, (s, a) => { s.weekContent = a.payload; })

      .addCase(generateSixWeekSummary.pending, (s) => { s.sixWeekStatus = 'generating'; })
      .addCase(generateSixWeekSummary.fulfilled, (s, a) => {
        s.sixWeekStatus = 'idle';
        s.sixWeekSummary = a.payload;
      })
      .addCase(generateSixWeekSummary.rejected, (s) => { s.sixWeekStatus = 'error'; })

      .addCase(checkMoodGap.fulfilled, (s, a) => { s.moodGapDays = a.payload; });
  },
});

export const { clearSixWeekSummary } = postpartumSlice.actions;
export default postpartumSlice.reducer;
