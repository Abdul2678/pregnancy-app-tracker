// app/features/community.tsx
// Community: post feed with categories, post detail with replies,
// create-post form with AI moderation feedback, AI reply suggestions.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, ScrollView, Switch, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  loadPosts, loadPost, createPost, likePost, reportPost, createReply,
  fetchReplySuggestions, setCategory, clearActivePost, clearModerationNote,
  CommunityPostSummary,
} from '../../store/communitySlice';
import { colors, spacing, radius, shadow } from '../../constants/theme';

const CATEGORIES: { key: string | null; label: string; emoji: string }[] = [
  { key: null,            label: 'All',           emoji: '🌸' },
  { key: 'general',       label: 'General',       emoji: '💬' },
  { key: 'symptoms',      label: 'Symptoms',      emoji: '🩺' },
  { key: 'nutrition',     label: 'Nutrition',     emoji: '🥗' },
  { key: 'mental_health', label: 'Wellbeing',     emoji: '💜' },
  { key: 'birth_stories', label: 'Birth Stories', emoji: '👶' },
  { key: 'newborn',       label: 'Newborn',       emoji: '🍼' },
  { key: 'partner',       label: 'Partners',      emoji: '🤝' },
];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Post card ───────────────────────────────────────────────────────────────

function PostCard({ post, onPress, onLike }: {
  post: CommunityPostSummary;
  onPress: () => void;
  onLike: () => void;
}) {
  const name = post.is_anonymous ? 'Anonymous' : (post.author_name ?? 'Anonymous');
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardHeader}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.author}>{name}</Text>
          <Text style={s.meta}>
            {timeAgo(post.created_at)}
            {post.pregnancy_week ? ` · Week ${post.pregnancy_week}` : ''}
          </Text>
        </View>
        {post.is_pinned ? <Ionicons name="pin" size={14} color={colors.rose} /> : null}
      </View>
      {post.title ? <Text style={s.title}>{post.title}</Text> : null}
      <Text style={s.body} numberOfLines={3}>{post.body_preview ?? post.body}</Text>
      <View style={s.cardFooter}>
        <TouchableOpacity style={s.footerBtn} onPress={onLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="heart-outline" size={16} color={colors.rose} />
          <Text style={s.footerText}>{post.like_count}</Text>
        </TouchableOpacity>
        <View style={s.footerBtn}>
          <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
          <Text style={s.footerText}>{post.reply_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Create post modal ───────────────────────────────────────────────────────

function CreatePostModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { postStatus, moderationNote } = useAppSelector((st) => st.community);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCat] = useState('general');
  const [anonymous, setAnonymous] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    const result = await dispatch(createPost({
      title: title.trim() || undefined,
      body: body.trim(),
      category,
      isAnonymous: anonymous,
    }));
    if (createPost.fulfilled.match(result)) {
      setTitle(''); setBody('');
      // Keep the modal open on rejection so the moderation note is visible
      const status = (result.payload as any)?.status;
      if (status === 'approved' || status === 'pending') onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalWrap}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New post</Text>
            <TouchableOpacity onPress={() => { dispatch(clearModerationNote()); onClose(); }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {CATEGORIES.filter((c) => c.key).map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[s.chip, category === c.key && s.chipActive]}
                  onPress={() => setCat(c.key!)}
                >
                  <Text style={[s.chipText, category === c.key && s.chipTextActive]}>
                    {c.emoji} {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={s.input}
              placeholder="Title (optional)"
              placeholderTextColor={colors.textLight}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
            <TextInput
              style={[s.input, s.inputMultiline]}
              placeholder="Share what's on your mind…"
              placeholderTextColor={colors.textLight}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={5000}
            />

            <View style={s.anonRow}>
              <Text style={s.anonLabel}>Post anonymously</Text>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                trackColor={{ true: colors.roseMid, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>

            {moderationNote ? (
              <View style={[s.modNote, postStatus === 'rejected' && s.modNoteError]}>
                <Ionicons
                  name={postStatus === 'rejected' ? 'alert-circle' : 'time-outline'}
                  size={16}
                  color={postStatus === 'rejected' ? colors.error : colors.lavender}
                />
                <Text style={s.modNoteText}>{moderationNote}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.submitBtn, (!body.trim() || postStatus === 'submitting') && s.submitBtnDisabled]}
              onPress={submit}
              disabled={!body.trim() || postStatus === 'submitting'}
            >
              {postStatus === 'submitting'
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.submitText}>Post</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Post detail modal ───────────────────────────────────────────────────────

function PostDetailModal({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const { activePost, activeReplies, replySuggestions, replyStatus, status } =
    useAppSelector((st) => st.community);
  const [reply, setReply] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    if (postId) {
      dispatch(loadPost(postId));
    }
    return () => { dispatch(clearActivePost()); };
  }, [dispatch, postId]);

  const suggest = () => {
    if (activePost) {
      dispatch(fetchReplySuggestions({ title: activePost.title, body: activePost.body ?? activePost.body_preview ?? '' }));
    }
  };

  const sendReply = async () => {
    if (!postId || !reply.trim()) return;
    const result = await dispatch(createReply({ postId, body: reply.trim(), isAnonymous: anonymous }));
    if (createReply.fulfilled.match(result)) setReply('');
  };

  const name = activePost?.is_anonymous ? 'Anonymous' : (activePost?.author_name ?? 'Anonymous');

  return (
    <Modal visible={!!postId} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={s.detailHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textDeep} />
          </TouchableOpacity>
          <Text style={s.detailHeaderTitle}>Post</Text>
          <TouchableOpacity
            onPress={() => { if (postId) { dispatch(reportPost(postId)); onClose(); } }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {status === 'loading' && !activePost ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.rose} />
        ) : activePost ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: spacing.md }}>
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.author}>{name}</Text>
                    <Text style={s.meta}>{timeAgo(activePost.created_at)}</Text>
                  </View>
                </View>
                {activePost.title ? <Text style={s.title}>{activePost.title}</Text> : null}
                <Text style={s.body}>{activePost.body ?? activePost.body_preview}</Text>
                <View style={s.cardFooter}>
                  <TouchableOpacity style={s.footerBtn} onPress={() => dispatch(likePost(activePost.id))}>
                    <Ionicons name="heart-outline" size={16} color={colors.rose} />
                    <Text style={s.footerText}>{activePost.like_count}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={s.sectionTitle}>
                {activeReplies.length} {activeReplies.length === 1 ? 'reply' : 'replies'}
              </Text>
              {activeReplies.map((r) => {
                const rName = r.is_anonymous ? 'Anonymous' : (r.author_name ?? 'Anonymous');
                return (
                  <View key={r.id} style={[s.replyCard, r.is_accepted && s.replyAccepted]}>
                    {r.is_accepted ? (
                      <View style={s.acceptedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                        <Text style={s.acceptedText}>Helpful answer</Text>
                      </View>
                    ) : null}
                    <Text style={s.replyAuthor}>{rName} · {timeAgo(r.created_at)}</Text>
                    <Text style={s.replyBody}>{r.body}</Text>
                  </View>
                );
              })}

              {replySuggestions.length > 0 ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={s.suggestLabel}>✨ Suggested replies</Text>
                  {replySuggestions.map((sug, i) => (
                    <TouchableOpacity key={i} style={s.suggestChip} onPress={() => setReply(sug)}>
                      <Text style={s.suggestText}>{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TouchableOpacity style={s.suggestBtn} onPress={suggest}>
                  <Ionicons name="sparkles-outline" size={15} color={colors.lavender} />
                  <Text style={s.suggestBtnText}>Help me write a reply</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={s.replyBar}>
              <TextInput
                style={s.replyInput}
                placeholder="Write a supportive reply…"
                placeholderTextColor={colors.textLight}
                value={reply}
                onChangeText={setReply}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[s.replySend, (!reply.trim() || replyStatus === 'submitting') && { opacity: 0.4 }]}
                onPress={sendReply}
                disabled={!reply.trim() || replyStatus === 'submitting'}
              >
                {replyStatus === 'submitting'
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Ionicons name="send" size={18} color={colors.white} />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { posts, category, hasMore, status } = useAppSelector((st) => st.community);
  const [showCreate, setShowCreate] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadPosts({ category }));
  }, [dispatch, category]);

  const loadMore = useCallback(() => {
    if (hasMore && status === 'idle') {
      dispatch(loadPosts({ category, offset: posts.length }));
    }
  }, [dispatch, category, hasMore, status, posts.length]);

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textDeep} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Community</Text>
        <View style={{ width: 24 }} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={[s.chip, category === c.key && s.chipActive]}
              onPress={() => dispatch(setCategory(c.key))}
            >
              <Text style={[s.chipText, category === c.key && s.chipTextActive]}>
                {c.emoji} {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => setOpenPostId(item.id)}
            onLike={() => dispatch(likePost(item.id))}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={status === 'loading' && posts.length > 0}
            onRefresh={() => dispatch(loadPosts({ category }))}
            tintColor={colors.rose}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          status === 'loading' ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.rose} />
          ) : (
            <View style={s.empty}>
              <Text style={{ fontSize: 44 }}>🌸</Text>
              <Text style={s.emptyTitle}>No posts yet</Text>
              <Text style={s.emptyText}>Be the first to share something with the community.</Text>
            </View>
          )
        }
        ListFooterComponent={status === 'loadingMore' ? <ActivityIndicator color={colors.rose} /> : null}
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <CreatePostModal visible={showCreate} onClose={() => setShowCreate(false)} />
      <PostDetailModal postId={openPostId} onClose={() => setOpenPostId(null)} />
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textDeep },

  catRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.rose, borderColor: colors.rose },
  chipText: { fontSize: 13, color: colors.textBody, fontWeight: '500' },
  chipTextActive: { color: colors.white },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg ?? 16,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.roseLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.rose, fontWeight: '700', fontSize: 14 },
  author: { fontSize: 14, fontWeight: '600', color: colors.textDeep },
  meta: { fontSize: 12, color: colors.textMuted },
  title: { fontSize: 15, fontWeight: '700', color: colors.textDeep, marginBottom: 4 },
  body: { fontSize: 14, color: colors.textBody, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', gap: 16, marginTop: 10 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 13, color: colors.textMuted },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textDeep, marginTop: 12 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 },

  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.black, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(61,20,64,0.35)' },
  modalCard: {
    backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.md, maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textDeep },
  input: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textDeep, marginBottom: spacing.sm,
  },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  anonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.sm },
  anonLabel: { fontSize: 14, color: colors.textBody },
  modNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.lavenderPale, borderRadius: 12, padding: 12, marginBottom: spacing.sm,
  },
  modNoteError: { backgroundColor: colors.errorLight },
  modNoteText: { flex: 1, fontSize: 13, color: colors.textBody, lineHeight: 18 },
  submitBtn: {
    backgroundColor: colors.rose, borderRadius: 24, paddingVertical: 14,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },

  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  detailHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.textDeep },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textDeep, marginVertical: spacing.sm },
  replyCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  replyAccepted: { borderColor: colors.success, backgroundColor: colors.successLight },
  acceptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  acceptedText: { fontSize: 11, color: colors.success, fontWeight: '600' },
  replyAuthor: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  replyBody: { fontSize: 14, color: colors.textBody, lineHeight: 19 },

  suggestLabel: { fontSize: 13, fontWeight: '600', color: colors.lavender, marginBottom: 6 },
  suggestChip: {
    backgroundColor: colors.lavenderPale, borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: colors.lavenderLight,
  },
  suggestText: { fontSize: 13, color: colors.textBody, lineHeight: 18 },
  suggestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 8, marginTop: 4,
  },
  suggestBtnText: { fontSize: 13, color: colors.lavender, fontWeight: '600' },

  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: spacing.sm, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  replyInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: colors.textDeep, maxHeight: 100,
  },
  replySend: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.rose,
    alignItems: 'center', justifyContent: 'center',
  },
});
