// store/index.ts
// Redux store configuration.

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

import auth from './authSlice';
import chat from './chatSlice';
import tracking from './trackingSlice';
import profile from './profileSlice';

export const store = configureStore({
  reducer: { auth, chat, tracking, profile },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
