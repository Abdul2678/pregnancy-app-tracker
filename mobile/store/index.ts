// store/index.ts
// Redux store configuration.

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

import auth from './authSlice';
import chat from './chatSlice';
import tracking from './trackingSlice';
import profile from './profileSlice';
import home from './homeSlice';
import development from './developmentSlice';
import mentalHealth from './mentalHealthSlice';
import planner from './plannerSlice';
import partner from './partnerSlice';
import settings from './settingsSlice';
import postpartum from './postpartumSlice';
import subscription from './subscriptionSlice';

export const store = configureStore({
  reducer: { auth, chat, tracking, profile, home, development, mentalHealth, planner, partner, settings, postpartum, subscription },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
