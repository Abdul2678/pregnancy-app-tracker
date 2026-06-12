// store/subscriptionSlice.ts
// Subscription state: tier, AI message quota, receipt validation.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionPeriod = 'monthly' | 'annual';

export interface SubscriptionState {
  tier: SubscriptionTier;
  period: SubscriptionPeriod | null;
  expiresAt: string | null;       // ISO string
  aiMessagesUsedToday: number;
  aiMessageLimit: number;         // 10 for free, 999 for premium
  lastMessageDate: string | null; // YYYY-MM-DD
  restoring: boolean;
  purchasing: boolean;
  validating: boolean;
  error: string | null;
}

const FREE_LIMIT = 10;
const PREMIUM_LIMIT = 999;
const STORE_KEY = 'bloom_subscription';

const initialState: SubscriptionState = {
  tier: 'free',
  period: null,
  expiresAt: null,
  aiMessagesUsedToday: 0,
  aiMessageLimit: FREE_LIMIT,
  lastMessageDate: null,
  restoring: false,
  purchasing: false,
  validating: false,
  error: null,
};

// ── Thunks ───────────────────────────────────────────────────────────────────

/** Load persisted subscription from SecureStore + sync with server */
export const loadSubscription = createAsyncThunk('subscription/load', async () => {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  const local = raw ? JSON.parse(raw) : null;

  try {
    const { data: res } = await api.get('/subscription/status');
    const remote = res?.data ?? res;
    return {
      tier: (remote.tier ?? 'free') as SubscriptionTier,
      period: (remote.period ?? null) as SubscriptionPeriod | null,
      expiresAt: remote.expires_at ?? null,
      aiMessagesUsedToday: local?.aiMessagesUsedToday ?? 0,
      lastMessageDate: local?.lastMessageDate ?? null,
    };
  } catch {
    return {
      tier: (local?.tier ?? 'free') as SubscriptionTier,
      period: (local?.period ?? null) as SubscriptionPeriod | null,
      expiresAt: local?.expiresAt ?? null,
      aiMessagesUsedToday: local?.aiMessagesUsedToday ?? 0,
      lastMessageDate: local?.lastMessageDate ?? null,
    };
  }
});

/** Validate a receipt from the App Store or Play Store */
export const validateReceipt = createAsyncThunk(
  'subscription/validate',
  async (payload: { receipt: string; platform: 'ios' | 'android'; productId: string }) => {
    const { data: res } = await api.post('/subscription/validate', payload);
    const d = res?.data ?? res;
    return {
      tier: d.tier as SubscriptionTier,
      period: d.period as SubscriptionPeriod,
      expiresAt: d.expires_at as string,
    };
  }
);

/** Restore purchases (re-validate existing App Store / Play receipt) */
export const restorePurchases = createAsyncThunk(
  'subscription/restore',
  async (payload: { receipt: string; platform: 'ios' | 'android' }) => {
    const { data: res } = await api.post('/subscription/restore', payload);
    const d = res?.data ?? res;
    return {
      tier: d.tier as SubscriptionTier,
      period: d.period as SubscriptionPeriod | null,
      expiresAt: d.expires_at as string | null,
    };
  }
);

// ── Slice ────────────────────────────────────────────────────────────────────

const slice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    /** Call when user sends an AI message — increments counter or resets if new day */
    recordAiMessage(state) {
      const today = new Date().toISOString().slice(0, 10);
      if (state.lastMessageDate !== today) {
        state.aiMessagesUsedToday = 1;
        state.lastMessageDate = today;
      } else {
        state.aiMessagesUsedToday += 1;
      }
      // Persist daily counter
      SecureStore.setItemAsync(
        STORE_KEY,
        JSON.stringify({
          tier: state.tier,
          period: state.period,
          expiresAt: state.expiresAt,
          aiMessagesUsedToday: state.aiMessagesUsedToday,
          lastMessageDate: state.lastMessageDate,
        })
      );
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    // load
    b.addCase(loadSubscription.fulfilled, (state, { payload }) => {
      state.tier = payload.tier;
      state.period = payload.period;
      state.expiresAt = payload.expiresAt;
      state.aiMessageLimit = payload.tier === 'premium' ? PREMIUM_LIMIT : FREE_LIMIT;
      const today = new Date().toISOString().slice(0, 10);
      if (payload.lastMessageDate === today) {
        state.aiMessagesUsedToday = payload.aiMessagesUsedToday;
      } else {
        state.aiMessagesUsedToday = 0;
      }
      state.lastMessageDate = payload.lastMessageDate;
    });

    // validate receipt
    b.addCase(validateReceipt.pending, (state) => { state.validating = true; state.error = null; });
    b.addCase(validateReceipt.fulfilled, (state, { payload }) => {
      state.validating = false;
      state.tier = payload.tier;
      state.period = payload.period;
      state.expiresAt = payload.expiresAt;
      state.aiMessageLimit = PREMIUM_LIMIT;
      SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ tier: state.tier, period: state.period, expiresAt: state.expiresAt, aiMessagesUsedToday: state.aiMessagesUsedToday, lastMessageDate: state.lastMessageDate }));
    });
    b.addCase(validateReceipt.rejected, (state, { error }) => {
      state.validating = false;
      state.error = error.message ?? 'Validation failed';
    });

    // restore
    b.addCase(restorePurchases.pending, (state) => { state.restoring = true; state.error = null; });
    b.addCase(restorePurchases.fulfilled, (state, { payload }) => {
      state.restoring = false;
      state.tier = payload.tier;
      state.period = payload.period;
      state.expiresAt = payload.expiresAt;
      state.aiMessageLimit = payload.tier === 'premium' ? PREMIUM_LIMIT : FREE_LIMIT;
    });
    b.addCase(restorePurchases.rejected, (state, { error }) => {
      state.restoring = false;
      state.error = error.message ?? 'Restore failed';
    });
  },
});

export const { recordAiMessage, clearError } = slice.actions;
export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectIsPremium = (s: { subscription: SubscriptionState }) =>
  s.subscription.tier === 'premium';

export const selectCanSendAiMessage = (s: { subscription: SubscriptionState }) => {
  const { tier, aiMessagesUsedToday, aiMessageLimit } = s.subscription;
  if (tier === 'premium') return true;
  return aiMessagesUsedToday < aiMessageLimit;
};

export const selectAiMessagesRemaining = (s: { subscription: SubscriptionState }) => {
  const { tier, aiMessagesUsedToday, aiMessageLimit } = s.subscription;
  if (tier === 'premium') return null; // unlimited
  return Math.max(0, aiMessageLimit - aiMessagesUsedToday);
};
