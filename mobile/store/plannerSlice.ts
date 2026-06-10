// store/plannerSlice.ts
// State for the Planner screen: checklist, appointments, birth plan, baby names.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  item: string;
  essential: boolean;
  note: string | null;
  checked: boolean;
  custom: boolean;
}

export interface ChecklistCategory {
  name: string;
  items: ChecklistItem[];
}

export interface AppointmentEntry {
  id: string;
  title: string;
  type: string;
  scheduled_at: string;
  duration_minutes?: number;
  location_name?: string | null;
  location_address?: string | null;
  provider_name?: string | null;
  status: string;
  notes?: string | null;
  pregnancy_week?: number | null;
}

export interface ShortlistedName {
  id: string;
  name: string;
  gender_fit?: string;
  origin?: string;
  meaning?: string;
  pronunciation?: string;
  syllables?: number;
  status: string;
  partner_status?: string;
}

export interface SuggestedName {
  name: string;
  origin?: string;
  meaning?: string;
  genderFit?: string;
  pronunciation?: string;
  syllables?: number;
}

interface PlannerState {
  checklistCategories: ChecklistCategory[];
  checklistStatus: 'idle' | 'loading' | 'loaded' | 'error';

  appointments: AppointmentEntry[];
  appointmentsStatus: 'idle' | 'loading' | 'error';

  birthPlanResult: Record<string, any> | null;
  birthPlanStatus: 'idle' | 'generating' | 'done' | 'error';

  suggestedNames: SuggestedName[];
  shortlistedNames: ShortlistedName[];
  namesStatus: 'idle' | 'loading' | 'error';
  shortlistStatus: 'idle' | 'loading' | 'error';
}

const initialState: PlannerState = {
  checklistCategories: [],
  checklistStatus: 'idle',
  appointments: [],
  appointmentsStatus: 'idle',
  birthPlanResult: null,
  birthPlanStatus: 'idle',
  suggestedNames: [],
  shortlistedNames: [],
  namesStatus: 'idle',
  shortlistStatus: 'idle',
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchChecklist = createAsyncThunk('planner/checklist', async () => {
  const { data } = await api.get('/features/hospital-bag');
  const payload = data?.data ?? data;
  const categories = (payload?.checklist?.categories ?? payload?.categories ?? []) as {
    name: string;
    items: { item: string; essential: boolean; note: string | null }[];
  }[];
  return categories.map((cat) => ({
    name: cat.name,
    items: cat.items.map((item, i) => ({
      id: `${cat.name}_${i}`,
      item: item.item,
      essential: item.essential ?? false,
      note: item.note ?? null,
      checked: false,
      custom: false,
    })),
  })) as ChecklistCategory[];
});

export const fetchAppointments = createAsyncThunk('planner/appointments', async () => {
  const { data } = await api.get('/appointments?filter=all&limit=50');
  const payload = data?.data ?? data;
  return (payload?.appointments ?? []) as AppointmentEntry[];
});

export const createAppointment = createAsyncThunk(
  'planner/createAppointment',
  async (payload: {
    title: string;
    type: string;
    scheduledAt: string;
    locationName?: string;
    notes?: string;
    reminderMinutes?: number[];
  }) => {
    const { data } = await api.post('/appointments', {
      title: payload.title,
      type: payload.type,
      scheduledAt: payload.scheduledAt,
      locationName: payload.locationName || null,
      notes: payload.notes || null,
      reminderMinutes: payload.reminderMinutes ?? [1440, 60],
    });
    const result = data?.data ?? data;
    return result?.appointment as AppointmentEntry;
  }
);

export const completeAppointment = createAsyncThunk(
  'planner/completeAppointment',
  async (id: string) => {
    await api.post(`/appointments/${id}/complete`);
    return id;
  }
);

export const deleteAppointment = createAsyncThunk(
  'planner/deleteAppointment',
  async (id: string) => {
    await api.delete(`/appointments/${id}`);
    return id;
  }
);

export const generateBirthPlan = createAsyncThunk(
  'planner/birthPlan',
  async (preferences: Record<string, string>) => {
    const { data } = await api.post('/features/birth-plan', { preferences });
    const payload = data?.data ?? data;
    return (payload?.plan ?? payload) as Record<string, any>;
  }
);

export const fetchSuggestedNames = createAsyncThunk(
  'planner/suggestNames',
  async (criteria: { gender?: string; style?: string; origin?: string; count?: number }) => {
    const { data } = await api.post('/ai/baby-names', { criteria });
    const payload = data?.data ?? data;
    return (payload?.suggestions ?? []) as SuggestedName[];
  }
);

export const fetchShortlist = createAsyncThunk('planner/shortlist', async () => {
  const { data } = await api.get('/ai/baby-names/shortlist');
  const payload = data?.data ?? data;
  return (payload?.names ?? []) as ShortlistedName[];
});

export const shortlistName = createAsyncThunk(
  'planner/addToShortlist',
  async (name: SuggestedName) => {
    const { data } = await api.post('/ai/baby-names/shortlist', {
      name: name.name,
      genderFit: name.genderFit,
      origin: name.origin,
      meaning: name.meaning,
      pronunciation: name.pronunciation,
      syllables: name.syllables,
    });
    const payload = data?.data ?? data;
    return payload?.name as ShortlistedName;
  }
);

export const updateNameStatus = createAsyncThunk(
  'planner/updateName',
  async ({ id, status }: { id: string; status: string }) => {
    const { data } = await api.put(`/ai/baby-names/shortlist/${id}`, { status });
    const payload = data?.data ?? data;
    return payload?.name as ShortlistedName;
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const plannerSlice = createSlice({
  name: 'planner',
  initialState,
  reducers: {
    toggleItem(state, action: PayloadAction<{ categoryName: string; itemId: string }>) {
      const cat = state.checklistCategories.find((c) => c.name === action.payload.categoryName);
      if (cat) {
        const item = cat.items.find((i) => i.id === action.payload.itemId);
        if (item) item.checked = !item.checked;
      }
    },
    addCustomItem(
      state,
      action: PayloadAction<{ categoryName: string; item: string }>
    ) {
      let cat = state.checklistCategories.find((c) => c.name === action.payload.categoryName);
      if (!cat) {
        state.checklistCategories.push({ name: action.payload.categoryName, items: [] });
        cat = state.checklistCategories[state.checklistCategories.length - 1];
      }
      cat.items.push({
        id: `custom_${Date.now()}`,
        item: action.payload.item,
        essential: false,
        note: null,
        checked: false,
        custom: true,
      });
    },
    clearBirthPlan(state) {
      state.birthPlanResult = null;
      state.birthPlanStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      // checklist
      .addCase(fetchChecklist.pending, (s) => { s.checklistStatus = 'loading'; })
      .addCase(fetchChecklist.fulfilled, (s, a) => {
        s.checklistStatus = 'loaded';
        s.checklistCategories = a.payload;
      })
      .addCase(fetchChecklist.rejected, (s) => { s.checklistStatus = 'error'; })
      // appointments
      .addCase(fetchAppointments.pending, (s) => { s.appointmentsStatus = 'loading'; })
      .addCase(fetchAppointments.fulfilled, (s, a) => {
        s.appointmentsStatus = 'idle';
        s.appointments = a.payload;
      })
      .addCase(fetchAppointments.rejected, (s) => { s.appointmentsStatus = 'error'; })
      .addCase(createAppointment.fulfilled, (s, a) => {
        if (a.payload) s.appointments.unshift(a.payload);
      })
      .addCase(completeAppointment.fulfilled, (s, a) => {
        const appt = s.appointments.find((ap) => ap.id === a.payload);
        if (appt) appt.status = 'completed';
      })
      .addCase(deleteAppointment.fulfilled, (s, a) => {
        s.appointments = s.appointments.filter((ap) => ap.id !== a.payload);
      })
      // birth plan
      .addCase(generateBirthPlan.pending, (s) => { s.birthPlanStatus = 'generating'; })
      .addCase(generateBirthPlan.fulfilled, (s, a) => {
        s.birthPlanStatus = 'done';
        s.birthPlanResult = a.payload;
      })
      .addCase(generateBirthPlan.rejected, (s) => { s.birthPlanStatus = 'error'; })
      // baby names
      .addCase(fetchSuggestedNames.pending, (s) => { s.namesStatus = 'loading'; })
      .addCase(fetchSuggestedNames.fulfilled, (s, a) => {
        s.namesStatus = 'idle';
        s.suggestedNames = a.payload;
      })
      .addCase(fetchSuggestedNames.rejected, (s) => { s.namesStatus = 'error'; })
      .addCase(fetchShortlist.pending, (s) => { s.shortlistStatus = 'loading'; })
      .addCase(fetchShortlist.fulfilled, (s, a) => {
        s.shortlistStatus = 'idle';
        s.shortlistedNames = a.payload;
      })
      .addCase(shortlistName.fulfilled, (s, a) => {
        if (a.payload) s.shortlistedNames.unshift(a.payload);
      })
      .addCase(updateNameStatus.fulfilled, (s, a) => {
        if (!a.payload) return;
        const idx = s.shortlistedNames.findIndex((n) => n.id === a.payload.id);
        if (idx !== -1) s.shortlistedNames[idx] = a.payload;
      });
  },
});

export const { toggleItem, addCustomItem, clearBirthPlan } = plannerSlice.actions;
export default plannerSlice.reducer;
