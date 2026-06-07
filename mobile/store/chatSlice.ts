// store/chatSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isEmergency?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  status: 'idle' | 'sending' | 'error';
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  conversationId: null,
  status: 'idle',
  error: null,
};

export const sendChatMessage = createAsyncThunk(
  'chat/send',
  async (message: string, { getState }) => {
    const state = getState() as { chat: ChatState };
    const { data } = await api.post('/chat', {
      message,
      conversationId: state.chat.conversationId ?? undefined,
    });
    return data as { reply: string; emergency: boolean; conversationId: string };
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addUserMessage(state, action: PayloadAction<string>) {
      state.messages.push({ role: 'user', content: action.payload });
    },
    clearChat(state) {
      state.messages = [];
      state.conversationId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (s) => {
        s.status = 'sending';
        s.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (s, a) => {
        s.status = 'idle';
        s.conversationId = a.payload.conversationId;
        s.messages.push({
          role: 'assistant',
          content: a.payload.reply,
          isEmergency: a.payload.emergency,
        });
      })
      .addCase(sendChatMessage.rejected, (s, a) => {
        s.status = 'error';
        s.error = a.error.message ?? 'Failed to send';
      });
  },
});

export const { addUserMessage, clearChat } = chatSlice.actions;
export default chatSlice.reducer;
