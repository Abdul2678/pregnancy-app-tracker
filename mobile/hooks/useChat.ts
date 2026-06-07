// hooks/useChat.ts

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { sendChatMessage, addUserMessage, clearChat } from '../store/chatSlice';

export function useChat() {
  const dispatch = useAppDispatch();
  const { messages, status, error } = useAppSelector((s) => s.chat);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      dispatch(addUserMessage(trimmed));
      await dispatch(sendChatMessage(trimmed));
    },
    [dispatch]
  );

  const reset = useCallback(() => dispatch(clearChat()), [dispatch]);

  return { messages, status, error, sending: status === 'sending', send, reset };
}
