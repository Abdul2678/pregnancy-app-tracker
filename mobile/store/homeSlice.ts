// store/homeSlice.ts
// Home screen data: week content, appointments, community, notification count.

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';

export interface WeekContent {
  week: number;
  headlineSentence?: string;
  did_you_know?: string;
  didYouKnow?: string;
  babySizeDescription?: string;
  baby_size_description?: string;
  developmentHighlights?: Array<{ system: string; detail: string }>;
  development_highlights?: Array<{ system: string; detail: string }>;
}

export interface Appointment {
  id: string;
  title: string;
  type: string;
  scheduled_at: string;
  location_name?: string | null;
  provider_name?: string | null;
  pregnancy_week?: number | null;
}

export interface CommunityPost {
  id: string;
  title: string;
  body: string;
  display_name?: string | null;
  reply_count?: number;
  created_at: string;
}

interface HomeState {
  weekContent:       WeekContent | null;
  appointments:      Appointment[];
  communityPost:     CommunityPost | null;
  unreadNotifCount:  number;
  loading: {
    weekContent:   boolean;
    appointments:  boolean;
    community:     boolean;
  };
  refreshing: boolean;
}

const initialState: HomeState = {
  weekContent:      null,
  appointments:     [],
  communityPost:    null,
  unreadNotifCount: 0,
  loading: {
    weekContent:   false,
    appointments:  false,
    community:     false,
  },
  refreshing: false,
};

// ─── Thunks ────────────────────────────────────────────────────────────────────

export const fetchWeekContent = createAsyncThunk(
  'home/weekContent',
  async (week: number) => {
    const { data } = await api.get(`/content/week/${week}`);
    return (data?.data ?? data) as WeekContent;
  }
);

export const fetchUpcomingAppointments = createAsyncThunk(
  'home/appointments',
  async () => {
    const { data } = await api.get('/appointments?filter=upcoming&limit=3');
    const payload = data?.data ?? data;
    return (payload?.appointments ?? []) as Appointment[];
  }
);

export const fetchCommunityHighlight = createAsyncThunk(
  'home/community',
  async () => {
    const { data } = await api.get('/community/posts?limit=1&sortBy=recent');
    const payload = data?.data ?? data;
    const posts = payload?.posts ?? payload;
    return (Array.isArray(posts) && posts.length > 0 ? posts[0] : null) as CommunityPost | null;
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'home/unreadNotifs',
  async () => {
    const { data } = await api.get('/notifications?unreadOnly=true&limit=1');
    const payload = data?.data ?? data;
    return (payload?.unreadCount ?? 0) as number;
  }
);

export const refreshHome = createAsyncThunk(
  'home/refresh',
  async (week: number, { dispatch }) => {
    await Promise.allSettled([
      dispatch(fetchWeekContent(week)),
      dispatch(fetchUpcomingAppointments()),
      dispatch(fetchCommunityHighlight()),
      dispatch(fetchUnreadCount()),
    ]);
  }
);

// ─── Slice ─────────────────────────────────────────────────────────────────────

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    decrementUnread(state) {
      state.unreadNotifCount = Math.max(0, state.unreadNotifCount - 1);
    },
    clearUnread(state) {
      state.unreadNotifCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeekContent.pending,  (s) => { s.loading.weekContent  = true; })
      .addCase(fetchWeekContent.fulfilled,(s, a) => { s.loading.weekContent = false; s.weekContent = a.payload; })
      .addCase(fetchWeekContent.rejected, (s) => { s.loading.weekContent  = false; })

      .addCase(fetchUpcomingAppointments.pending,  (s) => { s.loading.appointments  = true; })
      .addCase(fetchUpcomingAppointments.fulfilled,(s, a) => { s.loading.appointments = false; s.appointments = a.payload; })
      .addCase(fetchUpcomingAppointments.rejected, (s) => { s.loading.appointments  = false; })

      .addCase(fetchCommunityHighlight.pending,  (s) => { s.loading.community  = true; })
      .addCase(fetchCommunityHighlight.fulfilled,(s, a) => { s.loading.community = false; s.communityPost = a.payload; })
      .addCase(fetchCommunityHighlight.rejected, (s) => { s.loading.community  = false; })

      .addCase(fetchUnreadCount.fulfilled, (s, a) => { s.unreadNotifCount = a.payload; })

      .addCase(refreshHome.pending,   (s) => { s.refreshing = true; })
      .addCase(refreshHome.fulfilled, (s) => { s.refreshing = false; })
      .addCase(refreshHome.rejected,  (s) => { s.refreshing = false; });
  },
});

export const { decrementUnread, clearUnread } = homeSlice.actions;
export default homeSlice.reducer;
