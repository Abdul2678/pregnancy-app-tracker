// services/communityService.js
// Community post moderation + reply suggester.

const { jsonCall } = require('../lib/claude');
const {
  buildCommunityModerationPrompt,
  buildReplySuggesterPrompt,
} = require('../prompts/communityModerationPrompt');
const db = require('../db');

const ACTION_TO_STATUS = {
  approve: 'approved',
  review: 'review',
  block: 'blocked',
  escalate_support: 'review',
};

/**
 * createPost({ userId, title, body, language, parentPostId }) — moderate then persist.
 */
async function createPost({ userId, title = '', body, language = 'English', parentPostId = null }) {
  const moderation = await moderatePost({ postTitle: title, postBody: body, language });
  const status = ACTION_TO_STATUS[moderation.action] || 'review';

  const { rows } = await db.query(
    `INSERT INTO community_posts (user_id, parent_post_id, title, body, language, status, moderation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, parentPostId, title, body, language, status, JSON.stringify(moderation)]
  );
  return { ...rows[0], moderation };
}

/**
 * moderatePost({ postTitle, postBody, language }) → moderation JSON.
 */
async function moderatePost({ postTitle = '', postBody, language = 'English' }) {
  const { system, user } = buildCommunityModerationPrompt({ postTitle, postBody, language });
  return jsonCall({ system, userPrompt: user, maxTokens: 400 });
}

/**
 * applyModeration(postId) — re-run moderation on an existing post and update status.
 */
async function applyModeration(postId) {
  const { rows } = await db.query(`SELECT * FROM community_posts WHERE id = $1`, [postId]);
  if (!rows.length) return null;
  const post = rows[0];
  const moderation = await moderatePost({
    postTitle: post.title || '',
    postBody: post.body,
    language: post.language,
  });
  const status = ACTION_TO_STATUS[moderation.action] || 'review';
  const { rows: updated } = await db.query(
    `UPDATE community_posts SET status = $1, moderation = $2, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [status, JSON.stringify(moderation), postId]
  );
  return { ...updated[0], moderation };
}

/**
 * suggestReplies({ postTitle, postBody, language }) → reply suggestions JSON.
 */
async function suggestReplies({ postTitle = '', postBody, language = 'English' }) {
  const { system, user } = buildReplySuggesterPrompt({ postTitle, postBody, language });
  return jsonCall({ system, userPrompt: user, maxTokens: 400 });
}

/**
 * listPosts({ limit, offset }) — approved top-level posts.
 */
async function listPosts({ limit = 20, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT id, user_id, title, body, language, like_count, created_at
     FROM community_posts
     WHERE status = 'approved' AND parent_post_id IS NULL
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

module.exports = {
  createPost,
  moderatePost,
  applyModeration,
  suggestReplies,
  listPosts,
};
