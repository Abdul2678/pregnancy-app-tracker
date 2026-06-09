// store/chatSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api, ACCESS_TOKEN_KEY } from '../lib/api';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isEmergency?: boolean;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  status: 'idle' | 'streaming' | 'error';
  streamingContent: string;
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  conversationId: null,
  status: 'idle',
  streamingContent: '',
  error: null,
};

// Load history from backend on open
export const loadChatHistory = createAsyncThunk('chat/loadHistory', async () => {
  const { data } = await api.get('/chat/history', { params: { limit: 80 } });
  const rows: any[] = data?.data?.messages ?? data?.messages ?? [];
  if (!rows.length) return { messages: [], conversationId: null };

  const messages: ChatMessage[] = rows.map((r: any) => ({
    id: r.id ?? String(Math.random()),
    role: r.role,
    content: r.content,
    isEmergency: r.is_emergency ?? false,
    timestamp: new Date(r.created_at).getTime(),
  }));

  const conversationId = rows[0]?.conversation_id ?? null;
  return { messages, conversationId };
});

// Non-streaming fallback (kept for compatibility)
export const sendChatMessage = createAsyncThunk(
  'chat/send',
  async (message: string, { getState }) => {
    const state = getState() as { chat: ChatState };
    const { data } = await api.post('/chat', {
      message,
      conversationId: state.chat.conversationId ?? undefined,
    });
    const payload = data?.data ?? data;
    return payload as { reply: string; emergency: boolean; conversationId: string };
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addUserMessage(state, action: PayloadAction<{ content: string; id: string }>) {
      state.messages.push({
        id: action.payload.id,
        role: 'user',
        content: action.payload.content,
        timestamp: Date.now(),
      });
    },
    startStreaming(state) {
      state.status = 'streaming';
      state.streamingContent = '';
      state.error = null;
    },
    appendStreamChunk(state, action: PayloadAction<string>) {
      state.streamingContent += action.payload;
    },
    finalizeStream(
      state,
      action: PayloadAction<{ emergency: boolean; conversationId: string; id: string }>
    ) {
      state.status = 'idle';
      state.messages.push({
        id: action.payload.id,
        role: 'assistant',
        content: state.streamingContent,
        isEmergency: action.payload.emergency,
        timestamp: Date.now(),
      });
      state.streamingContent = '';
      state.conversationId = action.payload.conversationId;
    },
    streamError(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
      state.streamingContent = '';
    },
    setConversationId(state, action: PayloadAction<string>) {
      state.conversationId = action.payload;
    },
    clearChat(state) {
      state.messages = [];
      state.conversationId = null;
      state.streamingContent = '';
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadChatHistory.fulfilled, (s, a) => {
        s.messages = a.payload.messages;
        s.conversationId = a.payload.conversationId;
      })
      .addCase(sendChatMessage.pending, (s) => {
        s.status = 'streaming';
        s.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (s, a) => {
        s.status = 'idle';
        s.conversationId = a.payload.conversationId;
        s.messages.push({
          id: String(Date.now()),
          role: 'assistant',
          content: a.payload.reply,
          isEmergency: a.payload.emergency,
          timestamp: Date.now(),
        });
      })
      .addCase(sendChatMessage.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message ?? 'Failed to send';
      });
  },
});

export const {
  addUserMessage,
  startStreaming,
  appendStreamChunk,
  finalizeStream,
  streamError,
  setConversationId,
  clearChat,
} = chatSlice.actions;

// ── Streaming thunk (not createAsyncThunk — needs dispatch mid-flight) ─────────
const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) || 'http://localhost:4000/api';

export function streamChatMessage(message: string) {
  return async (dispatch: any, getState: any) => {
    const state = getState() as { chat: ChatState };
    const userMsgId = `u_${Date.now()}`;
    dispatch(addUserMessage({ content: message, id: userMsgId }));
    dispatch(startStreaming());

    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

      const response = await fetch(`${BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          message,
          conversationId: state.chat.conversationId ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          let parsed: any;
          try { parsed = JSON.parse(jsonStr); } catch { continue; }

          if (parsed.error) {
            dispatch(streamError(parsed.error));
            return;
          }
          if (parsed.done) {
            dispatch(finalizeStream({
              emergency: parsed.emergency ?? false,
              conversationId: parsed.conversationId ?? '',
              id: `a_${Date.now()}`,
            }));
            return;
          }
          if (parsed.text) {
            dispatch(appendStreamChunk(parsed.text));
          }
        }
      }

      // Stream ended without done frame — treat remaining buffer
      dispatch(finalizeStream({
        emergency: false,
        conversationId: getState().chat.conversationId ?? '',
        id: `a_${Date.now()}`,
      }));
    } catch (err: any) {
      dispatch(streamError(err?.message ?? 'Stream failed'));
    }
  };
}

export default chatSlice.reducer;
