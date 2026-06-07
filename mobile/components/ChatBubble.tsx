// components/ChatBubble.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isEmergency?: boolean;
}

export function ChatBubble({ role, content, isEmergency }: ChatBubbleProps) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.user : styles.assistant,
          isEmergency && styles.emergency,
        ]}
      >
        <Text style={[styles.text, isUser && styles.textUser, isEmergency && styles.textEmergency]}>
          {content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 4, flexDirection: 'row' },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  user: { backgroundColor: '#C97B63', borderBottomRightRadius: 4 },
  assistant: { backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#EEE5D8', borderBottomLeftRadius: 4 },
  emergency: { backgroundColor: '#FBE9E7', borderColor: '#E0A39B' },
  text: { fontSize: 15, color: '#3D2F22', lineHeight: 21 },
  textUser: { color: '#fff' },
  textEmergency: { color: '#9A2C22', fontWeight: '600' },
});

export default ChatBubble;
