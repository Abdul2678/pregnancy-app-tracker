// store/communitySlice.ts
// Community feed: posts, single post + replies, create/like/report, AI reply suggestions.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../lib/api';

export interface CommunityPostSummary {
  id: string;
  title: string;
  body_preview?: string;
  body?: string;
  category: string;
  language?: string;
  like_count: number;
  reply_count: number;
  view_count?: number;
  is_pinned?: boolean;
  is_anonymous?: boolean;
  pregnancy_week?: number | null;
  created_at: string;
  author_name?: string | null;
}

export interface CommunityReply {
  id: string;
  body: string;
  like_count: number;
  is_accepted: boolean;
  is_anonymous?: boolean;
  parent_reply_id?: string | null;
  created_at: string;
  author_name?: string | null;
}

interface CommunityState {
  posts:            CommunityPostSummary[];
  category:         string | null;
  hasMore:          boolean;
  activePost:       CommunityPostSummary | null;
  activeReplies:    CommunityReply[];
  replySuggestions: string[];
  status:           'idle' | 'loading' | 'loadingMore' | 'error';
  postStatus:       'idle' | 'submitting' | 'pending_moderation' | 'rejected' | 'error';
  moderationNote:   string | null;
  replyStatus:      'idle' | 'submitting' | 'error';
}

const initialState: CommunityState = {
  posts:            [],
  category:         null,
  hasMore:          true,
  activePost:       null,
  activeReplies:    [],
  replySuggestions: [],
  status:           'idle',
  postStatus:       'idle',
  moderationNote:   null,
  replyStatus:      'idle',
};

const PAGE = 20;

// ─── Thunks ────────────────────────────────────────────────────────────────────

export const loadPosts = createAsyncThunk(
  'community/loadPosts',
  async (opts: { category?: string | null; offset?: number } = {}) => {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(opts.offset ?? 0) });
    if (opts.category) params.set('category', opts.category);
    const { data } = await api.get(`/community/posts?${params.toString()}`);
    const payload = data?.data ?? data;
    return {
      posts:  (payload?.posts ?? []) as CommunityPostSummary[],
      offset: opts.offset ?? 0,
    };
  }
);

export const loadPost = createAsyncThunk(
  'community/loadPost',
  async (postId: string) => {
    const { data } = await api.get(`/community/posts/${postId}`);
    const payload = data?.data ?? data;
    return {
      post:    payload?.post as CommunityPostSummary,
      replies: (payload?.replies ?? []) as CommunityReply[],
    };
  }
);

export const createPost = createAsyncThunk(
  'community/createPost',
  async (payload: { title?: string; body: string; category: string; isAnonymous: boolean }) => {
    const { data } = await api.post('/community/posts', payload);
    const result = data?.data ?? data;
    return result?.post as CommunityPostSummary & { status?: string; moderation?: { reason?: string } };
  }
);

export const likePost = createAsyncThunk(
  'community/likePost',
  async (postId: string) => {
    const { data } = await api.post(`/community/posts/${postId}/like`);
    const payload = data?.data ?? data;
    return { postId, likeCount: payload?.likeCount as number };
  }
);

export const reportPost = createAsyncThunk(
  'community/reportPost',
  async (postId: string) => {
    await api.post(`/community/posts/${postId}/report`);
    return postId;
  }
);

export const createReply = createAsyncThunk(
  'community/createReply',
  async (payload: { postId: string; body: string; isAnonymous: boolean }) => {
    const { data } = await api.post(`/community/posts/${payload.postId}/replies`, {
      body: payload.body,
      isAnonymous: payload.isAnonymous,
    });
    return (data?.data ?? data)?.reply as CommunityReply & { status?: string };
  }
);

export const fetchReplySuggestions = createAsyncThunk(
  'community/replySuggestions',
  async (payload: { title?: string; body: string }) => {
    const { data } = await api.post('/community/reply-suggestions', payload);
    const result = data?.data ?? data;
    return (result?.suggestions ?? result?.replies ?? []) as string[];
  }
);

// ─── Slice ─────────────────────────────────────────────────────────────────────

const communitySlice = createSlice({
  name: 'community',
  initialState,
  reducers: {
    setCategory(state, action: PayloadAction<string | null>) {
      state.category = action.payload;
      state.posts = [];
      state.hasMore = true;
    },
    clearActivePost(state) {
      state.activePost = null;
      state.activeReplies = [];
      state.replySuggestions = [];
    },
    clearModerationNote(state) {
      state.moderationNote = null;
      state.postStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPosts.pending, (s, a) => {
        s.status = (a.meta.arg?.offset ?? 0) > 0 ? 'loadingMore' : 'loading';
      })
      .addCase(loadPosts.fulfilled, (s, a) => {
        s.status = 'idle';
        s.posts = a.payload.offset > 0 ? [...s.posts, ...a.payload.posts] : a.payload.posts;
        s.hasMore = a.payload.posts.length === PAGE;
      })
      .addCase(loadPosts.rejected, (s) => { s.status = 'error'; })

      .addCase(loadPost.pending, (s) => { s.status = 'loading'; })
      .addCase(loadPost.fulfilled, (s, a) => {
        s.status = 'idle';
        s.activePost = a.payload.post;
        s.activeReplies = a.payload.replies;
      })
      .addCase(loadPost.rejected, (s) => { s.status = 'error'; })

      .addCase(createPost.pending, (s) => { s.postStatus = 'submitting'; s.moderationNote = null; })
      .addCase(createPost.fulfilled, (s, a) => {
        const post = a.payload;
        if (!post) { s.postStatus = 'error'; return; }
        if (post.status === 'approved') {
          s.postStatus = 'idle';
          s.posts.unshift(post);
        } else if (post.status === 'rejected') {
          s.postStatus = 'rejected';
          s.moderationNote = post.moderation?.reason
            ?? 'Your post couldn’t be published. Please review our community guidelines and try again.';
        } else {
          s.postStatus = 'pending_moderation';
          s.moderationNote = 'Your post is being reviewed and will appear shortly.';
        }
      })
      .addCase(createPost.rejected, (s) => { s.postStatus = 'error'; })

      .addCase(likePost.fulfilled, (s, a) => {
        const p = s.posts.find((x) => x.id === a.payload.postId);
        if (p) p.like_count = a.payload.likeCount;
        if (s.activePost?.id === a.payload.postId) s.activePost.like_count = a.payload.likeCount;
      })

      .addCase(reportPost.fulfilled, (s, a) => {
        s.posts = s.posts.filter((p) => p.id !== a.payload);
      })

      .addCase(createReply.pending, (s) => { s.replyStatus = 'submitting'; })
      .addCase(createReply.fulfilled, (s, a) => {
        s.replyStatus = 'idle';
        if (a.payload && a.payload.status === 'approved') {
          s.activeReplies.push(a.payload);
          if (s.activePost) s.activePost.reply_count += 1;
        }
      })
      .addCase(createReply.rejected, (s) => { s.replyStatus = 'error'; })

      .addCase(fetchReplySuggestions.fulfilled, (s, a) => {
        s.replySuggestions = a.payload;
      });
  },
});

export const { setCategory, clearActivePost, clearModerationNote } = communitySlice.actions;
export default communitySlice.reducer;
