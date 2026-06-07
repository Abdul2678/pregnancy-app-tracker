// app/(tabs)/chat.tsx
// AI chat interface.

import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ChatBubble } from '../../components/ChatBubble';
import { useChat } from '../../hooks/useChat';

export default function Chat() {
  const { messages, send, sending } = useChat();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const onSend = async () => {
    const t = text;
    setText('');
    await send(t);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ChatBubble role={item.role} content={item.content} isEmergency={item.isEmergency} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Ask Bloom anything about your pregnancy.</Text>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor="#B7A992"
          multiline
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={onSend}
          disabled={!text.trim() || sending}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F4F1EA' },
  list: { padding: 16, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#9C8B76', marginTop: 60 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#FFFDF9',
    borderTopWidth: 1,
    borderTopColor: '#EEE5D8',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F4F1EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    color: '#3D2F22',
  },
  sendBtn: {
    backgroundColor: '#C97B63',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});
