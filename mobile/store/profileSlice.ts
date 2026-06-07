// store/profileSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

export interface UserProfile {
  currentWeek?: number;
  dueDate?: string;
  trimester?: number;
  country?: string;
  language?: string;
  contentTrack?: string;
  partnerMode?: boolean;
  postpartum?: boolean;
  babyAgeWeeks?: number;
  onboardingMessage?: string;
  [key: string]: unknown;
}

interface ProfileState {
  profile: UserProfile | null;
  dailyTip: any | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

const initialState: ProfileState = {
  profile: null,
  dailyTip: null,
  status: 'idle',
  error: null,
};

export const submitOnboarding = createAsyncThunk(
  'profile/onboarding',
  async (answers: Record<string, unknown>) => {
    const { data } = await api.post('/onboarding', answers);
    return data;
  }
);

export const fetchDailyTip = createAsyncThunk('profile/dailyTip', async () => {
  const { data } = await api.get('/content/daily-tip');
  return data.tip;
});

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<UserProfile>) {
      state.profile = action.payload;
    },
    togglePartnerMode(state) {
      if (state.profile) state.profile.partnerMode = !state.profile.partnerMode;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitOnboarding.pending, (s) => {
        s.status = 'loading';
      })
      .addCase(submitOnboarding.fulfilled, (s, a) => {
        s.status = 'idle';
        s.profile = a.payload.profile;
      })
      .addCase(submitOnboarding.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message ?? 'Onboarding failed';
      })
      .addCase(fetchDailyTip.fulfilled, (s, a) => {
        s.dailyTip = a.payload;
      });
  },
});

export const { setProfile, togglePartnerMode } = profileSlice.actions;
export default profileSlice.reducer;
