// routes/community.js
// GET  /api/community/posts          list approved posts
// POST /api/community/posts          create + AI moderate
// GET  /api/community/posts/:id      single post + replies
// DELETE /api/community/posts/:id    soft delete own post
// POST /api/community/posts/:id/like toggle like
// GET  /api/community/posts/:id/replies
// POST /api/community/posts/:id/replies create reply
// DELETE /api/community/replies/:id
// POST /api/community/replies/:id/accept
// POST /api/community/reply-suggestions AI draft
// POST /api/community/posts/:id/report

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }             = require('../middleware/validate');
const { authRequired }         = require('../middleware/auth');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimit');
const { ok, created, notFound, forbidden } = require('../middleware/respond');
const { createPost, listPosts, suggestReplies } = require('../../services/communityService');

const router = express.Router();

const CATEGORIES = ['general','symptoms','nutrition','mental_health',
  'birth_stories','newborn','partner','loss_support','ivf','multiples'];

const listSchema = z.object({
  category: z.string().optional(),
  language: z.string().optional(),
  search:   z.string().max(200).optional(),
  limit:    z.coerce.number().int().min(1).max(50).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

const createPostSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  body:        z.string().min(1).max(5000),
  category:    z.enum(CATEGORIES).default('general'),
  language:    z.string().max(10).default('en'),
  isAnonymous: z.boolean().default(false),
  tags:        z.array(z.string().max(50)).max(5).default([]),
});

const createReplySchema = z.object({
  body:          z.string().min(1).max(2000),
  parentReplyId: z.string().uuid().optional().nullable(),
  isAnonymous:   z.boolean().default(false),
});

const pagination = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

const replyHintSchema = z.object({
  title:    z.string().max(200).optional(),
  body:     z.string().min(1).max(5000),
  language: z.string().default('en'),
});

// LIST POSTS
router.get('/posts', authRequired, apiLimiter, validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const { category, language, search, limit, offset } = req.query;
    const conditions = ["p.status = 'approved'", 'p.deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (category) { conditions.push('p.category = $' + idx); params.push(category); idx++; }
    if (language) { conditions.push('p.language = $' + idx); params.push(language); idx++; }
    if (search) {
      conditions.push("to_tsvector('english', coalesce(p.title,'') || ' ' || p.body) @@ plainto_tsquery('english', $" + idx + ')');
      params.push(search); idx++;
    }
    params.push(limit, offset);
    const { rows } = await db.query(
      'SELECT p.id, p.title, LEFT(p.body,300) AS body_preview, p.category, p.language, p.like_count, p.reply_count, p.view_count, p.is_pinned, p.is_anonymous, p.pregnancy_week, p.created_at, CASE WHEN p.is_anonymous THEN NULL ELSE u.display_name END AS author_name FROM community_posts p LEFT JOIN users u ON u.id = p.user_id WHERE ' + conditions.join(' AND ') + ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT $' + idx + ' OFFSET $' + (idx+1),
      params
    );
    return ok(res, { posts: rows, limit, offset });
  } catch (err) { return next(err); }
});

// CREATE POST
router.post('/posts', authRequired, aiLimiter, validate(createPostSchema), async (req, res, next) => {
  try {
    const { rows: pregRows } = await db.query('SELECT current_week FROM pregnancies WHERE user_id = $1 AND is_current = TRUE LIMIT 1', [req.user.id]);
    const post = await createPost({
      userId: req.user.id, title: req.body.title || '', body: req.body.body,
      category: req.body.category, language: req.body.language,
      isAnonymous: req.body.isAnonymous, tags: req.body.tags,
      pregnancyWeek: pregRows[0] && pregRows[0].current_week,
    });
    return created(res, { post });
  } catch (err) { return next(err); }
});

// GET SINGLE POST
router.get('/posts/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    db.query("UPDATE community_posts SET view_count = view_count + 1 WHERE id = $1 AND status = 'approved'", [req.params.id]).catch(() => {});
    const { rows } = await db.query(
      "SELECT p.*, CASE WHEN p.is_anonymous THEN NULL ELSE u.display_name END AS author_name FROM community_posts p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = $1 AND p.status = 'approved' AND p.deleted_at IS NULL",
      [req.params.id]
    );
    if (!rows.length) return notFound(res, 'Post');
    const { rows: replies } = await db.query(
      "SELECT r.id, r.body, r.like_count, r.is_accepted, r.is_anonymous, r.parent_reply_id, r.created_at, CASE WHEN r.is_anonymous THEN NULL ELSE u.display_name END AS author_name FROM community_replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.post_id = $1 AND r.status = 'approved' AND r.deleted_at IS NULL ORDER BY r.is_accepted DESC, r.like_count DESC, r.created_at ASC LIMIT 20",
      [req.params.id]
    );
    return ok(res, { post: rows[0], replies });
  } catch (err) { return next(err); }
});

// DELETE POST
router.delete('/posts/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM community_posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!rows.length) return notFound(res, 'Post');
    if (rows[0].user_id !== req.user.id) return forbidden(res);
    await db.query("UPDATE community_posts SET deleted_at = now(), status = 'removed', updated_at = now() WHERE id = $1", [req.params.id]);
    return ok(res, { deleted: true });
  } catch (err) { return next(err); }
});

// LIKE POST
router.post('/posts/:id/like', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query("UPDATE community_posts SET like_count = like_count + 1, updated_at = now() WHERE id = $1 AND status = 'approved' AND deleted_at IS NULL RETURNING like_count", [req.params.id]);
    if (!rows.length) return notFound(res, 'Post');
    return ok(res, { likeCount: rows[0].like_count });
  } catch (err) { return next(err); }
});

// GET REPLIES
router.get('/posts/:id/replies', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const { rows } = await db.query(
      "SELECT r.id, r.body, r.like_count, r.is_accepted, r.is_anonymous, r.parent_reply_id, r.created_at, CASE WHEN r.is_anonymous THEN NULL ELSE u.display_name END AS author_name FROM community_replies r LEFT JOIN users u ON u.id = r.user_id WHERE r.post_id = $1 AND r.status = 'approved' AND r.deleted_at IS NULL ORDER BY r.is_accepted DESC, r.created_at ASC LIMIT $2 OFFSET $3",
      [req.params.id, limit, offset]
    );
    return ok(res, { replies: rows, limit, offset });
  } catch (err) { return next(err); }
});

// CREATE REPLY
router.post('/posts/:id/replies', authRequired, aiLimiter, validate(createReplySchema), async (req, res, next) => {
  try {
    const { rows: postRows } = await db.query("SELECT id FROM community_posts WHERE id = $1 AND status = 'approved' AND deleted_at IS NULL", [req.params.id]);
    if (!postRows.length) return notFound(res, 'Post');
    const modPost = await createPost({ userId: req.user.id, title: '', body: req.body.body, category: 'general', language: 'en', isAnonymous: req.body.isAnonymous, tags: [], _replyMode: true });
    const { rows: [reply] } = await db.query(
      'INSERT INTO community_replies (post_id, user_id, parent_reply_id, body, is_anonymous, status, moderation) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.id, req.user.id, req.body.parentReplyId || null, req.body.body, req.body.isAnonymous, modPost.status || 'pending', JSON.stringify(modPost.moderation || {})]
    );
    await db.query('UPDATE community_posts SET reply_count = reply_count + 1, updated_at = now() WHERE id = $1', [req.params.id]);
    return created(res, { reply });
  } catch (err) { return next(err); }
});

// DELETE REPLY
router.delete('/replies/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT user_id, post_id FROM community_replies WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!rows.length) return notFound(res, 'Reply');
    if (rows[0].user_id !== req.user.id) return forbidden(res);
    await db.query("UPDATE community_replies SET deleted_at = now(), status = 'removed', updated_at = now() WHERE id = $1", [req.params.id]);
    await db.query('UPDATE community_posts SET reply_count = GREATEST(reply_count - 1, 0), updated_at = now() WHERE id = $1', [rows[0].post_id]);
    return ok(res, { deleted: true });
  } catch (err) { return next(err); }
});

// ACCEPT REPLY
router.post('/replies/:id/accept', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT r.id, r.post_id, p.user_id AS post_author_id FROM community_replies r JOIN community_posts p ON p.id = r.post_id WHERE r.id = $1 AND r.deleted_at IS NULL', [req.params.id]);
    if (!rows.length) return notFound(res, 'Reply');
    if (rows[0].post_author_id !== req.user.id) return forbidden(res);
    await db.query('UPDATE community_replies SET is_accepted = FALSE, updated_at = now() WHERE post_id = $1', [rows[0].post_id]);
    await db.query('UPDATE community_replies SET is_accepted = TRUE, updated_at = now() WHERE id = $1', [req.params.id]);
    return ok(res, { accepted: true });
  } catch (err) { return next(err); }
});

// AI REPLY SUGGESTIONS
router.post('/reply-suggestions', authRequired, aiLimiter, validate(replyHintSchema), async (req, res, next) => {
  try {
    const result = await suggestReplies({ postTitle: req.body.title || '', postBody: req.body.body, language: req.body.language });
    return ok(res, result);
  } catch (err) { return next(err); }
});

// REPORT POST
router.post('/posts/:id/report', authRequired, apiLimiter, async (req, res, next) => {
  try {
    await db.query("UPDATE community_posts SET status = 'flagged', updated_at = now() WHERE id = $1 AND status = 'approved'", [req.params.id]);
    return ok(res, { reported: true });
  } catch (err) { return next(err); }
});

module.exports = router;
