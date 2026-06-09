// store/mentalHealthSlice.ts
// State for the mental health / wellbeing feature.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MoodDataPoint {
  date: string;       // YYYY-MM-DD
  avg_score: number;  // 1-5 float
  count: number;
  mood: string;
  risk_level: string;
}

export interface MoodAnalysis {
  riskLevel: 'ok' | 'low' | 'elevated' | 'high' | 'crisis';
  reflection: string;
  ppdScreenSuggested: boolean;
  suggestions: string[];
  resourcePrompt: string;
  crisis: boolean;
}

export interface MoodEntry {
  id: string;
  mood: string;
  mood_score: number;
  emotions: string[];
  note: string | null;
  risk_level: string;
  logged_at: string;
}

interface MentalHealthState {
  moodHistory: MoodDataPoint[];
  streak: number;
  lastCheckedIn: string | null;
  todayEntry: MoodEntry | null;
  todayAnalysis: MoodAnalysis | null;
  consecutiveLowDays: number;
  status: 'idle' | 'loading' | 'submitting' | 'error';
  error: string | null;
}

const initialState: MentalHealthState = {
  moodHistory: [],
  streak: 0,
  lastCheckedIn: null,
  todayEntry: null,
  todayAnalysis: null,
  consecutiveLowDays: 0,
  status: 'idle',
  error: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function countConsecutiveLow(history: MoodDataPoint[]): number {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;
  for (const d of sorted) {
    if (d.avg_score <= 2) count++;
    else break;
  }
  return count;
}

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loadMoodHistory = createAsyncThunk('mentalHealth/history', async () => {
  const { data } = await api.get('/tracking/mood/history?days=30');
  const payload = data?.data ?? data;
  return (payload?.days ?? []) as MoodDataPoint[];
});

export const loadMoodStreak = createAsyncThunk('mentalHealth/streak', async () => {
  const { data } = await api.get('/tracking/mood/streak');
  const payload = data?.data ?? data;
  return { streak: payload?.streak ?? 0, lastCheckedIn: payload?.lastCheckedIn ?? null };
});

export const submitMoodCheckin = createAsyncThunk(
  'mentalHealth/submit',
  async (payload: {
    mood: string;
    moodScore: number;
    emotions: string[];
    note: string;
  }) => {
    const { data } = await api.post('/tracking/mood', {
      mood: payload.mood,
      moodScore: payload.moodScore,
      emotions: payload.emotions,
      note: payload.note || null,
    });
    const result = data?.data ?? data;
    return {
      entry: result?.mood as MoodEntry,
      analysis: result?.analysis as MoodAnalysis,
    };
  }
);

// Load today's mood if already logged
export const loadTodayMood = createAsyncThunk('mentalHealth/today', async () => {
  const { data } = await api.get('/tracking/mood?limit=1');
  const payload = data?.data ?? data;
  const moods: MoodEntry[] = payload?.moods ?? [];
  if (!moods.length) return null;
  const latest = moods[0];
  if (latest.logged_at?.slice(0, 10) === todayISO()) return latest;
  return null;
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const mentalHealthSlice = createSlice({
  name: 'mentalHealth',
  initialState,
  reducers: {
    clearTodayAnalysis(state) {
      state.todayAnalysis = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMoodHistory.fulfilled, (s, a) => {
        s.moodHistory = a.payload;
        s.consecutiveLowDays = countConsecutiveLow(a.payload);
        // Derive today's entry from history if present
        const todayEntry = a.payload.find((d) => d.date === todayISO());
        if (todayEntry && !s.todayEntry) {
          // History only has aggregates — don't overwrite a full entry
        }
      })
      .addCase(loadMoodStreak.fulfilled, (s, a) => {
        s.streak = a.payload.streak;
        s.lastCheckedIn = a.payload.lastCheckedIn;
      })
      .addCase(loadTodayMood.fulfilled, (s, a) => {
        s.todayEntry = a.payload;
      })
      .addCase(submitMoodCheckin.pending, (s) => {
        s.status = 'submitting';
        s.error = null;
      })
      .addCase(submitMoodCheckin.fulfilled, (s, a) => {
        s.status = 'idle';
        s.todayEntry = a.payload.entry;
        s.todayAnalysis = a.payload.analysis;
        // Update streak optimistically
        if (s.lastCheckedIn !== todayISO()) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const isConsecutive = s.lastCheckedIn === yesterday.toISOString().slice(0, 10);
          s.streak = isConsecutive ? s.streak + 1 : 1;
          s.lastCheckedIn = todayISO();
        }
        // Update consecutive low tracking
        if (a.payload.entry?.mood_score <= 2) {
          s.consecutiveLowDays += 1;
        } else {
          s.consecutiveLowDays = 0;
        }
      })
      .addCase(submitMoodCheckin.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message ?? 'Failed to save';
      });
  },
});

export const { clearTodayAnalysis } = mentalHealthSlice.actions;
export default mentalHealthSlice.reducer;
