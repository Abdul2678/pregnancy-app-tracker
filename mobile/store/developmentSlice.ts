// store/developmentSlice.ts
// Per-week content cache for the Baby Development screen.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

export interface FullWeekContent {
  week: number;
  // headline
  headline_sentence?: string;
  headlineSentence?: string;
  // size
  baby_size_cm?: number;
  baby_size_g?: number;
  baby_size_inches?: number;
  baby_size_oz?: number;
  fruit_comparison?: string;
  fun_size_comparison?: string;
  baby_size_description?: string;
  babySizeDescription?: string;
  // development
  development_highlights?: Array<{ system: string; detail: string }>;
  developmentHighlights?: Array<{ system: string; detail: string }>;
  // symptoms
  common_symptoms?: Array<string | { name: string; description?: string }>;
  commonSymptoms?: Array<string | { name: string; description?: string }>;
  // mom body changes
  mom_body_changes?: Array<string | { change: string; detail?: string }>;
  momBodyChanges?: Array<string | { change: string; detail?: string }>;
  // tip
  weekly_tip?: string | { title: string; body: string };
  weeklyTip?: string | { title: string; body: string };
  // doctor questions
  doctor_questions?: string[];
  doctorQuestions?: string[];
  // did you know
  did_you_know?: string;
  didYouKnow?: string;
}

interface DevelopmentState {
  cache: Record<number, FullWeekContent>;
  loading: boolean;
  viewedWeek: number;
  units: 'metric' | 'imperial';
}

const initialState: DevelopmentState = {
  cache: {},
  loading: false,
  viewedWeek: 1,
  units: 'metric',
};

export const fetchDevelopmentWeek = createAsyncThunk(
  'development/fetchWeek',
  async (week: number, { getState }) => {
    const state = (getState() as any).development as DevelopmentState;
    if (state.cache[week]) return { week, content: state.cache[week] };
    const { data } = await api.get(`/content/week/${week}`);
    const content = (data?.data ?? data) as FullWeekContent;
    return { week, content: { ...content, week } };
  }
);

const developmentSlice = createSlice({
  name: 'development',
  initialState,
  reducers: {
    setViewedWeek(state, action: PayloadAction<number>) {
      state.viewedWeek = action.payload;
    },
    toggleUnits(state) {
      state.units = state.units === 'metric' ? 'imperial' : 'metric';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDevelopmentWeek.pending, (s) => { s.loading = true; })
      .addCase(fetchDevelopmentWeek.fulfilled, (s, a) => {
        s.loading = false;
        s.cache[a.payload.week] = a.payload.content;
      })
      .addCase(fetchDevelopmentWeek.rejected, (s) => { s.loading = false; });
  },
});

export const { setViewedWeek, toggleUnits } = developmentSlice.actions;
export default developmentSlice.reducer;
