// tests/kick-counter.test.tsx
// Kick counter: starting a session, tapping 10 kicks → completion state.

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '../store';
import KickCounter from '../app/features/kick-counter';

const renderScreen = () =>
  render(
    <Provider store={store}>
      <KickCounter />
    </Provider>
  );

describe('Kick counter', () => {
  it('renders the start state', () => {
    const { getByText } = renderScreen();
    expect(getByText('Start session')).toBeTruthy();
  });

  it('starting a session shows the tap button at 0 / 10', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Start session'));
    expect(getByText('tap to count')).toBeTruthy();
    expect(getByText('0')).toBeTruthy();
    expect(getByText('/ 10')).toBeTruthy();
  });

  it('each tap increments the count', () => {
    const { getByText, getAllByText } = renderScreen();
    fireEvent.press(getByText('Start session'));

    const tap = () => fireEvent.press(getByText(/tap to count/));
    act(() => { tap(); });
    expect(getAllByText('1').length).toBeGreaterThanOrEqual(1);
    act(() => { tap(); tap(); });
    expect(getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('10 kicks reaches the goal and shows the completion state', () => {
    const { getByText, getAllByText, queryByText } = renderScreen();
    fireEvent.press(getByText('Start session'));

    for (let i = 0; i < 10; i++) {
      act(() => {
        fireEvent.press(getByText(/tap to count|🎉/));
      });
    }

    expect(getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Baby is active!')).toBeTruthy();
    // Tap label switches away from "tap to count"
    expect(queryByText('tap to count')).toBeNull();
  });

  it('the tap button is disabled after the goal is reached', () => {
    const { getByText, getAllByText } = renderScreen();
    fireEvent.press(getByText('Start session'));

    for (let i = 0; i < 12; i++) {
      act(() => { fireEvent.press(getAllByText(/tap to count|🎉/)[0]); });
    }
    // Count must not exceed the goal once disabled
    expect(getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Baby is active!')).toBeTruthy();
  });
});
