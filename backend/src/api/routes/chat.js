// api/routes/chat.js
// POST /chat, GET /chat/history

const express = require('express');
const { z } = require('zod');

const db = require('../../db');
const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { sendMessage } = require('../../services/session');
const { getProfile } = require('../../services/profiles');

const router = express.Router();

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

async function getOrCreateConversation(userId, conversationId, mode) {
  if (conversationId) {
    const { rows } = await db.query(
      `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    if (rows.length) return rows[0];
  }
  const { rows } = await db.query(
    `INSERT INTO conversations (user_id, mode) VALUES ($1, $2) RETURNING *`,
    [userId, mode]
  );
  return rows[0];
}

async function loadHistory(conversationId, limit = 40) {
  const { rows } = await db.query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );
  return rows;
}

router.post('/', authRequired, aiLimiter, validate(chatSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const mode = profile.partnerMode ? 'partner' : profile.postpartum ? 'postpartum' : 'standard';
    const conversation = await getOrCreateConversation(req.user.id, req.body.conversationId, mode);
    const history = await loadHistory(conversation.id);

    const { reply, emergency } = await sendMessage({
      userProfile: profile,
      message: req.body.message,
      history,
    });

    await db.query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversation.id, req.body.message]
    );
    await db.query(
      `INSERT INTO messages (conversation_id, role, content, is_emergency)
       VALUES ($1, 'assistant', $2, $3)`,
      [conversation.id, reply, emergency]
    );
    await db.query(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [conversation.id]);

    return res.json({ reply, emergency, conversationId: conversation.id });
  } catch (err) {
    return next(err);
  }
});

router.get('/history', authRequired, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id AS conversation_id, c.title, c.mode, c.updated_at,
              m.role, m.content, m.is_emergency, m.created_at
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC, m.created_at ASC
       LIMIT 200`,
      [req.user.id]
    );
    return res.json({ messages: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
