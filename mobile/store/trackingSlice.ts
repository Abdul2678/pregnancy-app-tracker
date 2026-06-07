// store/trackingSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api';

interface TrackingState {
  symptoms: any[];
  moods: any[];
  weights: any[];
  contractionSessions: any[];
  status: 'idle' | 'loading' | 'submitting' | 'error';
  error: string | null;
  lastResult: any | null;
}

const initialState: TrackingState = {
  symptoms: [],
  moods: [],
  weights: [],
  contractionSessions: [],
  status: 'idle',
  error: null,
  lastResult: null,
};

export const fetchTrackingHistory = createAsyncThunk('tracking/history', async () => {
  const { data } = await api.get('/tracking/history');
  return data;
});

export const logSymptom = createAsyncThunk(
  'tracking/symptom',
  async (payload: { symptomText: string; severity?: number; durationHours?: number }) => {
    const { data } = await api.post('/tracking/symptoms', payload);
    return data;
  }
);

export const logMood = createAsyncThunk(
  'tracking/mood',
  async (payload: { mood: string; note?: string }) => {
    const { data } = await api.post('/tracking/mood', payload);
    return data;
  }
);

export const logWeight = createAsyncThunk(
  'tracking/weight',
  async (payload: { weightKg: number; prePregnancyWeightKg?: number; heightCm?: number }) => {
    const { data } = await api.post('/tracking/weight', payload);
    return data;
  }
);

export const logContractions = createAsyncThunk(
  'tracking/contractions',
  async (payload: { contractions: { startTime: string; durationSec: number; intervalSec?: number }[] }) => {
    const { data } = await api.post('/tracking/contractions', payload);
    return data;
  }
);

const trackingSlice = createSlice({
  name: 'tracking',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrackingHistory.pending, (s) => {
        s.status = 'loading';
      })
      .addCase(fetchTrackingHistory.fulfilled, (s, a) => {
        s.status = 'idle';
        s.symptoms = a.payload.symptoms ?? [];
        s.moods = a.payload.moods ?? [];
        s.weights = a.payload.weights ?? [];
        s.contractionSessions = a.payload.contractionSessions ?? [];
      });

    [logSymptom, logMood, logWeight, logContractions].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (s) => {
          s.status = 'submitting';
          s.error = null;
        })
        .addCase(thunk.fulfilled, (s, a) => {
          s.status = 'idle';
          s.lastResult = a.payload;
        })
        .addCase(thunk.rejected, (s, a) => {
          s.status = 'error';
          s.error = a.error.message ?? 'Failed to log';
        });
    });
  },
});

export default trackingSlice.reducer;
