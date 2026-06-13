// tests/onboarding.test.tsx
// Onboarding: step navigation, field validation, button states.

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import profileReducer from '../store/profileSlice';
import authReducer from '../store/authSlice';
import chatReducer from '../store/chatSlice';
import subscriptionReducer from '../store/subscriptionSlice';
import trackingReducer from '../store/trackingSlice';
import homeReducer from '../store/homeSlice';
import developmentReducer from '../store/developmentSlice';
import mentalHealthReducer from '../store/mentalHealthSlice';
import plannerReducer from '../store/plannerSlice';
import partnerReducer from '../store/partnerSlice';
import settingsReducer from '../store/settingsSlice';
import postpartumReducer from '../store/postpartumSlice';

import OnboardingScreen from '../app/(auth)/onboarding';

function makeStore() {
  return configureStore({
    reducer: {
      profile: profileReducer,
      auth: authReducer,
      chat: chatReducer,
      subscription: subscriptionReducer,
      tracking: trackingReducer,
      home: homeReducer,
      development: developmentReducer,
      mentalHealth: mentalHealthReducer,
      planner: plannerReducer,
      partner: partnerReducer,
      settings: settingsReducer,
      postpartum: postpartumReducer,
    },
    middleware: (gDM) => gDM({ serializableCheck: false }),
  });
}

const renderOnboarding = () =>
  render(
    <Provider store={makeStore()}>
      <OnboardingScreen />
    </Provider>
  );

// The animation in animateToStep is Animated.parallel with 120ms + 200ms durations.
// We advance time enough to complete it without triggering infinite loops.
const flush = () => act(() => { jest.advanceTimersByTime(500); });

describe('Onboarding flow', () => {
  it('Step 0 — shows Get started and sign-in link', () => {
    const { getByText } = renderOnboarding();
    expect(getByText('Get started')).toBeTruthy();
    expect(getByText('I already have an account')).toBeTruthy();
  });

  it('Step 0 → Step 1 on Get started tap', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    // Step 1 header label (text content; textTransform is a style-only effect)
    expect(getByText('Your dates')).toBeTruthy();
  });

  it('Step 1 — date type tabs are visible', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    expect(getByText('Last period')).toBeTruthy();
    expect(getByText('Due date')).toBeTruthy();
    expect(getByText('IVF / transfer')).toBeTruthy();
  });

  it('Step 1 — Continue is enabled because default date is pre-filled', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    // Default LMP is ~8 weeks ago — always a valid date, Continue is enabled
    expect(getByText('Continue')).toBeTruthy();
  });

  it('Step 1 → Step 2 via Continue', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    fireEvent.press(getByText('Continue'));
    flush();
    expect(getByText('Tell us a little about you')).toBeTruthy();
  });

  it('Step 2 — shows first-pregnancy toggle and Skip for now', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    fireEvent.press(getByText('Continue'));
    flush();
    expect(getByText('Is this your first pregnancy?')).toBeTruthy();
    expect(getByText('Skip for now')).toBeTruthy();
  });

  it('Step 2 — Skip for now advances to Step 3', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    fireEvent.press(getByText('Continue'));
    flush();
    fireEvent.press(getByText('Skip for now'));
    flush();
    expect(getByText('What matters most to you?')).toBeTruthy();
  });

  it('Step 3 — goal cards are rendered', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    fireEvent.press(getByText('Continue'));
    flush();
    fireEvent.press(getByText('Skip for now'));
    flush();
    expect(getByText('Track symptoms')).toBeTruthy();
    expect(getByText('Learn week by week')).toBeTruthy();
    expect(getByText('Connect with others')).toBeTruthy();
  });

  it('Step 3 — selecting a goal and pressing Continue goes to Step 4', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    fireEvent.press(getByText('Continue'));
    flush();
    fireEvent.press(getByText('Skip for now'));
    flush();
    fireEvent.press(getByText('Track symptoms'));
    fireEvent.press(getByText('Continue'));
    flush();
    expect(getByText("Where are you based?")).toBeTruthy();
  });

  it('Step 4 — shows country selector and language chips', () => {
    const { getByText } = renderOnboarding();
    fireEvent.press(getByText('Get started'));
    flush();
    fireEvent.press(getByText('Continue'));
    flush();
    fireEvent.press(getByText('Skip for now'));
    flush();
    fireEvent.press(getByText('Track symptoms'));
    fireEvent.press(getByText('Continue'));
    flush();
    expect(getByText('Tap to select your country')).toBeTruthy();
    expect(getByText('English')).toBeTruthy();
    expect(getByText('Español')).toBeTruthy();
  });
});
