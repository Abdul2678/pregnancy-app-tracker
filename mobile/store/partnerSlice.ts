// store/partnerSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';
import { ShortlistedName } from './plannerSlice';

export interface PartnerView {
  pregnancy: Record<string, any> | null;
  currentWeek: number | null;
  dueDate: string | null;
  recentMoods: { mood: string; mood_score: number; logged_at: string }[];
  recentKicks: { kick_count: number; target_kicks: number; target_met: boolean; started_at: string }[];
  latestWeight: { weight_kg: number; logged_at: string } | null;
  weekContent: Record<string, any> | null;
  privacy: { shareMood: boolean; shareWeight: boolean; shareSymptoms: boolean };
}

export interface PrivacySettings {
  shareMood: boolean;
  shareWeight: boolean;
  shareSymptoms: boolean;
}

interface PartnerState {
  view: PartnerView | null;
  viewStatus: 'idle' | 'loading' | 'error';

  linkStatus: 'none' | 'pending' | 'accepted' | 'revoked';
  linkInfo: Record<string, any> | null;
  linkLoading: boolean;

  inviteCode: string | null;
  inviteCodeExpiry: string | null;
  codeLoading: boolean;

  privacy: PrivacySettings;
  privacyLoading: boolean;

  partnerNames: ShortlistedName[];
  namesLoading: boolean;
}

const initialState: PartnerState = {
  view: null,
  viewStatus: 'idle',
  linkStatus: 'none',
  linkInfo: null,
  linkLoading: false,
  inviteCode: null,
  inviteCodeExpiry: null,
  codeLoading: false,
  privacy: { shareMood: false, shareWeight: false, shareSymptoms: false },
  privacyLoading: false,
  partnerNames: [],
  namesLoading: false,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loadPartnerView = createAsyncThunk('partner/view', async () => {
  const { data } = await api.get('/partner/view');
  return (data?.data ?? data) as PartnerView;
});

export const loadPartnerStatus = createAsyncThunk('partner/status', async () => {
  const { data } = await api.get('/partner');
  return data?.data ?? data;
});

export const generateInviteCode = createAsyncThunk('partner/generateCode', async () => {
  const { data } = await api.post('/partner/code');
  return data?.data ?? data;
});

export const updatePrivacy = createAsyncThunk(
  'partner/privacy',
  async (settings: Partial<PrivacySettings>) => {
    const { data } = await api.put('/partner/privacy', settings);
    return (data?.data ?? data).privacy as PrivacySettings;
  }
);

export const revokePartner = createAsyncThunk('partner/revoke', async () => {
  await api.delete('/partner');
});

export const loadPartnerNames = createAsyncThunk('partner/names', async () => {
  const { data } = await api.get('/partner/names');
  const payload = data?.data ?? data;
  return (payload?.names ?? []) as ShortlistedName[];
});

export const voteOnName = createAsyncThunk(
  'partner/voteOnName',
  async ({ id, status }: { id: string; status: 'loved' | 'maybe' | 'vetoed' }) => {
    const { data } = await api.put(`/partner/names/${id}/vote`, { status });
    const payload = data?.data ?? data;
    return payload?.name as ShortlistedName;
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const partnerSlice = createSlice({
  name: 'partner',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPartnerView.pending, (s) => { s.viewStatus = 'loading'; })
      .addCase(loadPartnerView.fulfilled, (s, a) => { s.viewStatus = 'idle'; s.view = a.payload; })
      .addCase(loadPartnerView.rejected, (s) => { s.viewStatus = 'error'; })

      .addCase(loadPartnerStatus.pending, (s) => { s.linkLoading = true; })
      .addCase(loadPartnerStatus.fulfilled, (s, a) => {
        s.linkLoading = false;
        s.linkInfo    = a.payload.link;
        s.linkStatus  = a.payload.linked ? 'accepted' : (a.payload.link?.status ?? 'none');
        if (a.payload.link?.privacy_json) s.privacy = a.payload.link.privacy_json;
      })
      .addCase(loadPartnerStatus.rejected, (s) => { s.linkLoading = false; })

      .addCase(generateInviteCode.pending, (s) => { s.codeLoading = true; })
      .addCase(generateInviteCode.fulfilled, (s, a) => {
        s.codeLoading       = false;
        s.inviteCode        = a.payload.code;
        s.inviteCodeExpiry  = a.payload.expiresAt;
      })
      .addCase(generateInviteCode.rejected, (s) => { s.codeLoading = false; })

      .addCase(updatePrivacy.pending, (s) => { s.privacyLoading = true; })
      .addCase(updatePrivacy.fulfilled, (s, a) => { s.privacyLoading = false; s.privacy = a.payload; })
      .addCase(updatePrivacy.rejected, (s) => { s.privacyLoading = false; })

      .addCase(revokePartner.fulfilled, (s) => {
        s.linkStatus  = 'none';
        s.linkInfo    = null;
        s.inviteCode  = null;
      })

      .addCase(loadPartnerNames.pending, (s) => { s.namesLoading = true; })
      .addCase(loadPartnerNames.fulfilled, (s, a) => { s.namesLoading = false; s.partnerNames = a.payload; })
      .addCase(loadPartnerNames.rejected, (s) => { s.namesLoading = false; })

      .addCase(voteOnName.fulfilled, (s, a) => {
        if (!a.payload) return;
        const idx = s.partnerNames.findIndex((n) => n.id === a.payload.id);
        if (idx !== -1) s.partnerNames[idx] = a.payload;
        else s.partnerNames = s.partnerNames.filter((n) => n.id !== a.payload.id);
      });
  },
});

export default partnerSlice.reducer;
