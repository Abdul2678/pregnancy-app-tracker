// api/routes/community.js
// GET /posts, POST /posts, POST /posts/:id/moderate

const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { aiLimiter, apiLimiter } = require('../middleware/rateLimit');
const {
  createPost,
  applyModeration,
  listPosts,
  suggestReplies,
} = require('../../services/communityService');

const router = express.Router();

router.get('/posts', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const posts = await listPosts({ limit, offset });
    return res.json({ posts });
  } catch (err) {
    return next(err);
  }
});

const postSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  language: z.string().optional(),
  parentPostId: z.string().uuid().optional(),
});

router.post('/posts', authRequired, aiLimiter, validate(postSchema), async (req, res, next) => {
  try {
    const post = await createPost({
      userId: req.user.id,
      title: req.body.title || '',
      body: req.body.body,
      language: req.body.language || 'English',
      parentPostId: req.body.parentPostId || null,
    });
    return res.status(201).json({ post });
  } catch (err) {
    return next(err);
  }
});

router.post('/posts/:id/moderate', authRequired, aiLimiter, async (req, res, next) => {
  try {
    const post = await applyModeration(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json({ post });
  } catch (err) {
    return next(err);
  }
});

const replySchema = z.object({
  title: z.string().optional(),
  body: z.string().min(1).max(5000),
  language: z.string().optional(),
});

router.post('/reply-suggestions', authRequired, aiLimiter, validate(replySchema), async (req, res, next) => {
  try {
    const suggestions = await suggestReplies({
      postTitle: req.body.title || '',
      postBody: req.body.body,
      language: req.body.language || 'English',
    });
    return res.json(suggestions);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
