// store/authSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api, { setTokens, clearTokens, getAccessToken } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  accountType: 'primary' | 'partner';
}

interface AuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
  bootstrapped: boolean;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
  bootstrapped: false,
};

export const login = createAsyncThunk(
  'auth/login',
  async (creds: { email: string; password: string }) => {
    const { data } = await api.post('/auth/login', creds);
    await setTokens(data.accessToken, data.refreshToken);
    return data.user as AuthUser;
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (payload: { email: string; password: string; displayName?: string }) => {
    const { data } = await api.post('/auth/register', payload);
    await setTokens(data.accessToken, data.refreshToken);
    return data.user as AuthUser;
  }
);

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const { data } = await api.get('/user/profile');
    const p = data?.data ?? data;
    return {
      id:          p.id ?? p.userId ?? '',
      email:       p.email ?? '',
      accountType: (p.accountType ?? p.account_type ?? 'primary') as 'primary' | 'partner',
    } as AuthUser;
  } catch {
    return null;
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await clearTokens();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.status = action.payload ? 'authenticated' : 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(login.fulfilled, (s, a) => { s.status = 'authenticated'; s.user = a.payload; })
      .addCase(login.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message ?? 'Login failed'; })
      .addCase(register.fulfilled, (s, a) => { s.status = 'authenticated'; s.user = a.payload; })
      .addCase(register.rejected, (s, a) => { s.status = 'error'; s.error = a.error.message ?? 'Registration failed'; })
      .addCase(bootstrapAuth.fulfilled, (s, a) => {
        s.bootstrapped = true;
        if (a.payload) {
          s.user   = a.payload;
          s.status = 'authenticated';
        }
      })
      .addCase(logout.fulfilled, (s) => { s.user = null; s.status = 'idle'; });
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
