// hooks/useTracking.ts

import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTrackingHistory,
  logSymptom,
  logMood,
  logWeight,
  logContractions,
} from '../store/trackingSlice';

export function useTracking(autoFetch = false) {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.tracking);

  useEffect(() => {
    if (autoFetch) dispatch(fetchTrackingHistory());
  }, [autoFetch, dispatch]);

  const refresh = useCallback(() => dispatch(fetchTrackingHistory()), [dispatch]);

  const submitSymptom = useCallback(
    (payload: { symptomText: string; severity?: number; durationHours?: number }) =>
      dispatch(logSymptom(payload)).unwrap(),
    [dispatch]
  );

  const submitMood = useCallback(
    (payload: { mood: string; note?: string }) => dispatch(logMood(payload)).unwrap(),
    [dispatch]
  );

  const submitWeight = useCallback(
    (payload: { weightKg: number; prePregnancyWeightKg?: number; heightCm?: number }) =>
      dispatch(logWeight(payload)).unwrap(),
    [dispatch]
  );

  const submitContractions = useCallback(
    (payload: { contractions: { startTime: string; durationSec: number; intervalSec?: number }[] }) =>
      dispatch(logContractions(payload)).unwrap(),
    [dispatch]
  );

  return {
    ...state,
    refresh,
    submitSymptom,
    submitMood,
    submitWeight,
    submitContractions,
  };
}
