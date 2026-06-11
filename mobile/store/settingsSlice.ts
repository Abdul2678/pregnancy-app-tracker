// store/settingsSlice.ts
// App-wide user preferences: language, units, date format, timezone.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import api from '../lib/api';
import { setLocale, RTL_LANGUAGES } from '../lib/i18n';
import type { UnitSystem, DateFormat } from '../lib/units';

const SETTINGS_KEY = 'bloom.settings';

export interface SettingsState {
  language:    string;
  unitSystem:  UnitSystem;
  dateFormat:  DateFormat;
  timezone:    string;
  country:     string;
  status:      'idle' | 'saving' | 'error';
}

const deviceLocale  = getLocales()[0]?.languageCode ?? 'en';
const deviceCountry = getLocales()[0]?.regionCode  ?? 'GB';

const initialState: SettingsState = {
  language:   deviceLocale,
  unitSystem: deviceCountry === 'US' ? 'imperial' : 'metric',
  dateFormat: deviceCountry === 'US' ? 'MDY' : 'DMY',
  timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
  country:    deviceCountry,
  status:     'idle',
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loadSettings = createAsyncThunk('settings/load', async () => {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as Partial<SettingsState>;
  } catch {}
  return null;
});

export const saveSettings = createAsyncThunk(
  'settings/save',
  async (patch: Partial<SettingsState>, { getState }) => {
    const state = (getState() as any).settings as SettingsState;
    const next  = { ...state, ...patch };
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
    try {
      await api.put('/user/preferences', {
        unitSystem: next.unitSystem,
      });
      await api.put('/user/language', { language: next.language });
      await api.put('/user/profile', {
        country:  next.country,
        timezone: next.timezone,
        language: next.language,
        unitSystem: next.unitSystem,
      });
    } catch {}
    return patch;
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    applyLanguage(state, action: PayloadAction<string>) {
      state.language = action.payload;
      setLocale(action.payload);
    },
    applyUnits(state, action: PayloadAction<UnitSystem>) {
      state.unitSystem = action.payload;
    },
    applyDateFormat(state, action: PayloadAction<DateFormat>) {
      state.dateFormat = action.payload;
    },
    applyTimezone(state, action: PayloadAction<string>) {
      state.timezone = action.payload;
    },
    applyCountry(state, action: PayloadAction<string>) {
      state.country = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        if (!action.payload) return;
        const p = action.payload;
        if (p.language)   { state.language   = p.language;   setLocale(p.language); }
        if (p.unitSystem) state.unitSystem = p.unitSystem;
        if (p.dateFormat) state.dateFormat = p.dateFormat;
        if (p.timezone)   state.timezone   = p.timezone;
        if (p.country)    state.country    = p.country;
      })
      .addCase(saveSettings.pending,   (s) => { s.status = 'saving'; })
      .addCase(saveSettings.fulfilled, (s, a) => {
        s.status = 'idle';
        Object.assign(s, a.payload);
        if (a.payload.language) setLocale(a.payload.language);
      })
      .addCase(saveSettings.rejected,  (s) => { s.status = 'error'; });
  },
});

export const { applyLanguage, applyUnits, applyDateFormat, applyTimezone, applyCountry } =
  settingsSlice.actions;
export default settingsSlice.reducer;
