// app/(tabs)/chat.tsx
// AI Chat — streaming SSE, emergency detection, suggested prompts, disclaimer.

import React, {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
  Linking, Modal, ScrollView, Alert, Pressable, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  streamChatMessage, clearChat, loadChatHistory,
  ChatMessage,
} from '../../store/chatSlice';
import {
  selectCanSendAiMessage, selectAiMessagesRemaining, recordAiMessage,
} from '../../store/subscriptionSlice';
import SoftPaywall from '../../components/SoftPaywall';
import { colors, spacing, radius, shadow } from '../../constants/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCLAIMER_KEY = 'bloom.chatDisclaimerAccepted';

const SUGGESTED_PROMPTS = [
  { icon: '🤰', text: "What symptoms are normal this trimester?" },
  { icon: '😴', text: "How can I sleep better during pregnancy?" },
  { icon: '🥗', text: "What foods should I avoid eating?" },
  { icon: '💊', text: "Is it safe to take paracetamol?" },
  { icon: '👶', text: "What size is my baby this week?" },
  { icon: '🏥', text: "When should I call my midwife?" },
];

const AI_FOOTER = "Not medical advice. Always consult your healthcare provider.";

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(480 - i * 160),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.bloomAvatar}>
        <Text style={styles.bloomAvatarText}>🌸</Text>
      </View>
      <View style={styles.typingBubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                transform: [{
                  translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
                }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

interface DisplayMessage extends ChatMessage {
  isStreaming?: boolean;
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.bloomAvatar}>
          <Text style={styles.bloomAvatarText}>🌸</Text>
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleAssistant,
        msg.isEmergency && styles.bubbleEmergency,
      ]}>
        {msg.isEmergency && (
          <View style={styles.emergencyBanner}>
            <Ionicons name="warning" size={13} color={colors.white} />
            <Text style={styles.emergencyBannerText}>Emergency — seek care now</Text>
          </View>
        )}
        <Text style={[
          styles.bubbleText,
          isUser ? styles.textUser : styles.textAssistant,
        ]}>
          {msg.content}
          {msg.isStreaming ? <Text style={styles.cursor}> ▋</Text> : null}
        </Text>
        {!isUser && !msg.isStreaming && (
          <Text style={styles.aiFooter}>{AI_FOOTER}</Text>
        )}
        {msg.isEmergency && (
          <TouchableOpacity
            style={styles.emergencyCallBtn}
            onPress={() => Linking.openURL('tel:999')}
          >
            <Ionicons name="call" size={13} color={colors.white} />
            <Text style={styles.emergencyCallText}>Call Emergency Services</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Disclaimer modal ──────────────────────────────────────────────────────────

function DisclaimerModal({ onAccept }: { onAccept: () => void }) {
  return (
    <Modal transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>Before we chat 🌸</Text>
          <Text style={styles.disclaimerBody}>
            Bloom is an AI companion here to support you — not a medical professional.
            {'\n\n'}
            The information I provide is for general guidance only. Always talk to your midwife,
            doctor, or healthcare provider for medical advice, diagnosis, or treatment.
            {'\n\n'}
            In an emergency, call your local emergency services (999, 911, 112) immediately.
          </Text>
          <TouchableOpacity style={styles.disclaimerBtn} onPress={onAccept}>
            <Text style={styles.disclaimerBtnText}>I understand, let's chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const dispatch = useAppDispatch();
  const { messages, status, streamingContent } = useAppSelector((s) => s.chat);

  const canSend        = useAppSelector(selectCanSendAiMessage);
  const msgsRemaining  = useAppSelector(selectAiMessagesRemaining);

  const [input, setInput] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerLoaded, setDisclaimerLoaded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const isStreaming = status === 'streaming';

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_KEY).then((val: string | null) => {
      if (!val) setShowDisclaimer(true);
      setDisclaimerLoaded(true);
    });
    dispatch(loadChatHistory());
  }, [dispatch]);

  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length, streamingContent]);

  const acceptDisclaimer = useCallback(async () => {
    await AsyncStorage.setItem(DISCLAIMER_KEY, '1');
    setShowDisclaimer(false);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    if (!canSend) { setShowPaywall(true); return; }
    setInput('');
    dispatch(recordAiMessage());
    dispatch(streamChatMessage(text) as any);
  }, [input, isStreaming, canSend, dispatch]);

  const handleSuggestedPrompt = useCallback((prompt: string) => {
    if (isStreaming) return;
    if (!canSend) { setShowPaywall(true); return; }
    dispatch(recordAiMessage());
    dispatch(streamChatMessage(prompt) as any);
  }, [isStreaming, canSend, dispatch]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Clear conversation', 'This will delete all messages. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => dispatch(clearChat()) },
    ]);
    setShowMenu(false);
  }, [dispatch]);

  const handlePhotoUpload = useCallback(async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      dispatch(streamChatMessage(
        "I've sent a photo. Please describe what you see and I'll help."
      ) as any);
    }
  }, [dispatch]);

  const displayMessages: DisplayMessage[] = useMemo(() => {
    const list: DisplayMessage[] = [...messages];
    if (isStreaming && streamingContent) {
      list.push({
        id: 'streaming',
        role: 'assistant',
        content: streamingContent,
        isStreaming: true,
        timestamp: Date.now(),
      });
    }
    return list;
  }, [messages, isStreaming, streamingContent]);

  const showSuggested = messages.length === 0 && !isStreaming;

  if (!disclaimerLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {showDisclaimer && <DisclaimerModal onAccept={acceptDisclaimer} />}

      {/* Custom header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarEmoji}>🌸</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Bloom</Text>
            <Text style={styles.headerSubtitle}>
              {isStreaming ? 'Thinking…' : 'Your pregnancy companion'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowMenu((v) => !v)} style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textBody} />
        </TouchableOpacity>
      </View>

      {showMenu && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Clear conversation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowDisclaimer(true);
              setShowMenu(false);
            }}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textBody} />
              <Text style={styles.menuItemText}>View disclaimer</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={showSuggested ? (
            <View style={styles.suggestedContainer}>
              <View style={styles.suggestedHero}>
                <Text style={styles.suggestedHeroEmoji}>🌸</Text>
                <Text style={styles.suggestedHeroTitle}>Hi, I'm Bloom</Text>
                <Text style={styles.suggestedHeroSub}>
                  Your AI pregnancy companion. Ask me anything.
                </Text>
              </View>
              <Text style={styles.suggestedLabel}>Suggested questions</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SUGGESTED_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p.text}
                    style={styles.suggestedChip}
                    onPress={() => handleSuggestedPrompt(p.text)}
                  >
                    <Text style={styles.suggestedChipIcon}>{p.icon}</Text>
                    <Text style={styles.suggestedChipText}>{p.text}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
          ListFooterComponent={isStreaming && !streamingContent ? <TypingDots /> : null}
        />

        {/* Free tier message counter */}
        {msgsRemaining !== null && (
          <TouchableOpacity
            style={[styles.limitBar, msgsRemaining <= 3 && styles.limitBarWarn]}
            onPress={() => setShowPaywall(true)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={12} color={msgsRemaining <= 3 ? '#C0524A' : '#8A7359'} />
            <Text style={[styles.limitText, msgsRemaining <= 3 && styles.limitTextWarn]}>
              {msgsRemaining === 0
                ? 'Daily limit reached — tap to upgrade'
                : `${msgsRemaining} free message${msgsRemaining !== 1 ? 's' : ''} left today · Upgrade`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Input bar */}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputIconBtn} onPress={handlePhotoUpload}>
            <Ionicons name="attach" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Message Bloom…"
            placeholderTextColor={colors.textLight}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!isStreaming}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isStreaming) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={17} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <SoftPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason="ai_limit"
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.roseLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textDeep },
  headerSubtitle: { fontSize: 12, color: colors.textMuted },
  menuBtn: { padding: spacing.xs },

  menuCard: {
    position: 'absolute', top: 58, right: spacing.md, zIndex: 100,
    backgroundColor: colors.surface, borderRadius: radius.md,
    ...shadow.md, paddingVertical: spacing.xs, minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  menuItemText: { fontSize: 14, color: colors.textBody },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },

  messageRow: { flexDirection: 'row', marginTop: spacing.sm, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start', gap: spacing.xs },

  bloomAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.roseLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  bloomAvatarText: { fontSize: 16 },

  bubble: { maxWidth: '78%', borderRadius: radius.lg, padding: spacing.sm + 2 },
  bubbleUser: { backgroundColor: colors.rose, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.surface, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  bubbleEmergency: { backgroundColor: '#FFF0F2', borderColor: colors.error, borderWidth: 1.5 },

  bubbleText: { fontSize: 15, lineHeight: 22 },
  textUser: { color: colors.white },
  textAssistant: { color: colors.textBody },
  cursor: { color: colors.rose },
  aiFooter: {
    fontSize: 10, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic',
  },

  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.error, padding: spacing.xs,
    borderRadius: radius.sm, marginBottom: spacing.xs,
  },
  emergencyBannerText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  emergencyCallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.error, padding: spacing.xs,
    borderRadius: radius.sm, marginTop: spacing.xs, alignSelf: 'flex-start',
  },
  emergencyCallText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  typingContainer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs,
    marginTop: spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row', gap: 5, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm,
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted,
  },

  suggestedContainer: { paddingTop: spacing.xl, paddingBottom: spacing.md },
  suggestedHero: { alignItems: 'center', marginBottom: spacing.xl },
  suggestedHeroEmoji: { fontSize: 52 },
  suggestedHeroTitle: {
    fontSize: 22, fontWeight: '700', color: colors.textDeep, marginTop: spacing.sm,
  },
  suggestedHeroSub: {
    fontSize: 14, color: colors.textMuted, textAlign: 'center',
    marginTop: spacing.xs, paddingHorizontal: spacing.xl,
  },
  suggestedLabel: {
    fontSize: 11, color: colors.textMuted, fontWeight: '600',
    letterSpacing: 0.5, marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  suggestedChip: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginRight: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    maxWidth: 220,
  },
  suggestedChipIcon: { fontSize: 16 },
  suggestedChipText: { fontSize: 13, color: colors.textBody, flexShrink: 1 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.sm,
  },
  inputIconBtn: { padding: spacing.xs, marginBottom: 4 },
  textInput: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 15, color: colors.textBody,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.rose,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.textLight },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  disclaimerCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xl, maxWidth: 380, width: '100%',
  },
  disclaimerTitle: {
    fontSize: 20, fontWeight: '700', color: colors.textDeep,
    textAlign: 'center', marginBottom: spacing.md,
  },
  disclaimerBody: { fontSize: 14, lineHeight: 22, color: colors.textBody },
  disclaimerBtn: {
    marginTop: spacing.xl, backgroundColor: colors.rose,
    borderRadius: radius.pill, paddingVertical: spacing.sm + 4, alignItems: 'center',
  },
  disclaimerBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  limitBar:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFF8E1' },
  limitBarWarn:  { backgroundColor: '#FFF0F0' },
  limitText:     { fontSize: 11, color: '#8A7359', fontWeight: '600', flex: 1 },
  limitTextWarn: { color: '#C0524A' },
});
