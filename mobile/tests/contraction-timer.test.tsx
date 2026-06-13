// tests/contraction-timer.test.tsx
// Contraction timer: the tap sequence (start → end → start…) must produce
// correctly-ordered contractions with sane durations and intervals.

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '../store';
import ContractionTimer from '../app/features/contraction-timer';

const renderScreen = () =>
  render(
    <Provider store={store}>
      <ContractionTimer />
    </Provider>
  );

describe('Contraction timer — tap sequence', () => {
  beforeEach(() => {
    jest.setSystemTime(new Date('2026-06-12T10:00:00Z'));
  });

  it('renders the idle state with a start button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Start timing')).toBeTruthy();
    expect(getByText('Tap when a contraction begins')).toBeTruthy();
  });

  it('first tap starts the session AND the first contraction', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Start timing'));
    expect(getByText('Contraction ended')).toBeTruthy(); // button now offers to end
    expect(getByText('Tap when it stops')).toBeTruthy();
  });

  it('start → +70s end produces one contraction with the correct duration', () => {
    const { getByText, getAllByText } = renderScreen();

    fireEvent.press(getByText('Start timing'));            // contraction starts at T0
    act(() => { jest.advanceTimersByTime(70_000); });       // 70 seconds pass
    fireEvent.press(getByText('Contraction ended'));        // ends at T0+70s

    expect(getByText(/This session \(1 contraction\)/)).toBeTruthy();
    // Duration 70s renders as "1m 10s" in the contraction list (may appear in multiple places)
    expect(getAllByText(/1m 10s/).length).toBeGreaterThanOrEqual(1);
  });

  it('a full sequence produces correct timestamps and intervals', () => {
    const { getByText } = renderScreen();

    // Contraction 1: 0:00 → 1:00
    fireEvent.press(getByText('Start timing'));
    act(() => { jest.advanceTimersByTime(60_000); });
    fireEvent.press(getByText('Contraction ended'));

    // Rest 4 minutes
    act(() => { jest.advanceTimersByTime(240_000); });

    // Contraction 2: 5:00 → 6:10
    fireEvent.press(getByText('Contraction started'));
    act(() => { jest.advanceTimersByTime(70_000); });
    fireEvent.press(getByText('Contraction ended'));

    expect(getByText(/This session \(2 contractions\)/)).toBeTruthy();
    // Second contraction shows its interval since the previous one ended (4m)
    expect(getByText(/↔ 4m 00s/)).toBeTruthy();
  });

  it('button label alternates through the whole sequence', () => {
    const { getByText } = renderScreen();

    fireEvent.press(getByText('Start timing'));
    expect(getByText('Contraction ended')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(45_000); });
    fireEvent.press(getByText('Contraction ended'));
    expect(getByText('Contraction started')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(120_000); });
    fireEvent.press(getByText('Contraction started'));
    expect(getByText('Contraction ended')).toBeTruthy();
  });
});
