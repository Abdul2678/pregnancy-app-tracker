// tests/chat.test.tsx
// Chat screen: emergency messages show red banner and call button.

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { store } from '../store';
import ChatScreen from '../app/(tabs)/chat';

// ── API message fixtures (shape returned by the backend) ──────────────────────

const NOW_ISO = new Date('2026-06-12T10:00:00Z').toISOString();

const API_EMERGENCY_MSG = {
  id: 'em-1',
  role: 'assistant',
  content: 'This sounds like an emergency. Please call 999 or go to hospital immediately.',
  is_emergency: true,
  created_at: NOW_ISO,
  conversation_id: 'conv-1',
};

const API_NORMAL_MSG = {
  id: 'nm-1',
  role: 'assistant',
  content: 'Mild nausea is common at week 8. Try eating small, frequent meals.',
  is_emergency: false,
  created_at: NOW_ISO,
  conversation_id: 'conv-1',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockHistory(messages: object[]) {
  const { api } = require('../lib/api');
  api.get.mockImplementation((url: string) => {
    if (url.includes('/chat/history') || url.includes('history')) {
      return Promise.resolve({ data: { data: { messages } } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
}

const renderChat = () =>
  render(
    <Provider store={store}>
      <ChatScreen />
    </Provider>
  );

// Flush async effects (AsyncStorage + loadChatHistory thunk)
const flush = async () => act(async () => { await Promise.resolve(); });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Chat screen', () => {
  beforeEach(() => {
    // Disclaimer already accepted
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue('1');
  });

  it('renders the empty state with suggested prompts', async () => {
    mockHistory([]);
    const { getByText } = renderChat();
    await flush();
    await flush();
    expect(getByText("Hi, I'm Bloom")).toBeTruthy();
    expect(getByText('Suggested questions')).toBeTruthy();
  });

  it('normal assistant message does NOT show emergency banner', async () => {
    mockHistory([API_NORMAL_MSG]);
    const { queryByText } = renderChat();
    await flush();
    await flush();
    expect(queryByText('Emergency — seek care now')).toBeNull();
    expect(queryByText('Call Emergency Services')).toBeNull();
  });

  it('emergency message shows the red banner', async () => {
    mockHistory([API_EMERGENCY_MSG]);
    const { getByText } = renderChat();
    await flush();
    await flush();
    expect(getByText('Emergency — seek care now')).toBeTruthy();
  });

  it('emergency message shows the Call Emergency Services button', async () => {
    mockHistory([API_EMERGENCY_MSG]);
    const { getByText } = renderChat();
    await flush();
    await flush();
    expect(getByText('Call Emergency Services')).toBeTruthy();
  });

  it('emergency message content is rendered', async () => {
    mockHistory([API_EMERGENCY_MSG]);
    const { getByText } = renderChat();
    await flush();
    await flush();
    expect(getByText(/call 999|hospital/i)).toBeTruthy();
  });

  it('normal message renders without emergency styling', async () => {
    mockHistory([API_NORMAL_MSG]);
    const { getByText, queryByText } = renderChat();
    await flush();
    await flush();
    expect(getByText(/mild nausea/i)).toBeTruthy();
    expect(queryByText('Emergency — seek care now')).toBeNull();
  });

  it('disclaimer modal appears when not yet accepted', async () => {
    mockHistory([]);
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
    const { getByText } = renderChat();
    await flush();
    await flush();
    expect(getByText('Before we chat 🌸')).toBeTruthy();
    expect(getByText("I understand, let's chat")).toBeTruthy();
  });

  it('accepting the disclaimer hides the modal', async () => {
    mockHistory([]);
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
    const { getByText, queryByText } = renderChat();
    await flush();
    await flush();
    fireEvent.press(getByText("I understand, let's chat"));
    await flush();
    expect(queryByText('Before we chat 🌸')).toBeNull();
  });
});
