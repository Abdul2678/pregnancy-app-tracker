// store/profileSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

export interface UserProfile {
  currentWeek?:       number;
  dueDate?:           string;
  trimester?:         number;
  country?:           string;
  language?:          string;
  contentTrack?:      string;
  partnerMode?:       boolean;
  postpartum?:        boolean;
  babyAgeWeeks?:      number;
  onboardingMessage?: string;
  isFirstPregnancy?:  boolean;
  goals?:             string[];
  healthConditions?:  string[];
  [key: string]: unknown;
}

export interface NotifPrefs {
  dailyTip:             boolean;
  appointmentReminders: boolean;
  weeklyUpdate:         boolean;
}

interface ProfileState {
  profile:              UserProfile | null;
  dailyTip:             any | null;
  notifPrefs:           NotifPrefs;
  onboardingCompleted:  boolean;
  status:               'idle' | 'loading' | 'error';
  error:                string | null;
}

const defaultNotifPrefs: NotifPrefs = {
  dailyTip:             true,
  appointmentReminders: true,
  weeklyUpdate:         true,
};

const initialState: ProfileState = {
  profile:             null,
  dailyTip:            null,
  notifPrefs:          defaultNotifPrefs,
  onboardingCompleted: false,
  status:              'idle',
  error:               null,
};

export const submitOnboarding = createAsyncThunk(
  'profile/onboarding',
  async (answers: Record<string, unknown>) => {
    const { data } = await api.post('/onboarding', answers);
    // Handle both { profile } and { data: { profile } } response shapes
    return (data?.data ?? data) as { profile: UserProfile; onboardingMessage?: string };
  }
);

export const fetchDailyTip = createAsyncThunk('profile/dailyTip', async () => {
  const { data } = await api.get('/content/daily-tip');
  return (data?.data ?? data)?.tip ?? null;
});

export const fetchProfile = createAsyncThunk('profile/fetch', async () => {
  const { data } = await api.get('/user/profile');
  return (data?.data ?? data) as UserProfile;
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
    setNotifPrefs(state, action: PayloadAction<Partial<NotifPrefs>>) {
      state.notifPrefs = { ...state.notifPrefs, ...action.payload };
    },
    setOnboardingCompleted(state, action: PayloadAction<boolean>) {
      state.onboardingCompleted = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // submitOnboarding
      .addCase(submitOnboarding.pending, (s) => {
        s.status = 'loading';
        s.error  = null;
      })
      .addCase(submitOnboarding.fulfilled, (s, a) => {
        s.status = 'idle';
        s.profile = a.payload?.profile ?? a.payload as any;
        s.onboardingCompleted = true;
      })
      .addCase(submitOnboarding.rejected, (s, a) => {
        s.status = 'error';
        s.error  = a.error.message ?? 'Onboarding failed';
      })
      // fetchDailyTip
      .addCase(fetchDailyTip.fulfilled, (s, a) => {
        s.dailyTip = a.payload;
      })
      // fetchProfile
      .addCase(fetchProfile.fulfilled, (s, a) => {
        s.profile = a.payload;
      });
  },
});

export const { setProfile, togglePartnerMode, setNotifPrefs, setOnboardingCompleted } =
  profileSlice.actions;

export default profileSlice.reducer;
