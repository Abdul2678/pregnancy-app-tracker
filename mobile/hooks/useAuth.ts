// hooks/useAuth.ts

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { login, register, logout, bootstrapAuth } from '../store/authSlice';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, status, error, bootstrapped } = useAppSelector((s) => s.auth);

  const isAuthenticated = status === 'authenticated';

  const signIn = useCallback(
    (email: string, password: string) => dispatch(login({ email, password })).unwrap(),
    [dispatch]
  );

  const signUp = useCallback(
    (email: string, password: string, displayName?: string) =>
      dispatch(register({ email, password, displayName })).unwrap(),
    [dispatch]
  );

  const signOut = useCallback(() => dispatch(logout()).unwrap(), [dispatch]);
  const bootstrap = useCallback(() => dispatch(bootstrapAuth()).unwrap(), [dispatch]);

  return { user, status, error, bootstrapped, isAuthenticated, signIn, signUp, signOut, bootstrap };
}
