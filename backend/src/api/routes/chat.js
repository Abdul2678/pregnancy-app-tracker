// routes/chat.js
// POST /api/chat, GET /api/chat/history

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }      = require('../middleware/validate');
const { authRequired }  = require('../middleware/auth');
const { aiLimiter, apiLimiter } = require('../middleware/rateLimit');
const { ok }            = require('../middleware/respond');
const { sendMessage }   = require('../../services/session');
const { getProfile }    = require('../../services/profiles');

const router = express.Router();

const chatSchema = z.object({
  message:        z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

async function getOrCreate(userId, conversationId, mode) {
  if (conversationId) {
    const { rows } = await db.query(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [conversationId, userId]
    );
    if (rows.length) return rows[0];
  }
  const { rows } = await db.query(
    'INSERT INTO conversations (user_id, mode) VALUES ($1, $2) RETURNING *',
    [userId, mode]
  );
  return rows[0];
}

router.post('/', authRequired, aiLimiter, validate(chatSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const mode = profile.partnerMode ? 'partner' : profile.postpartum ? 'postpartum' : 'standard';
    const conversation = await getOrCreate(req.user.id, req.body.conversationId, mode);

    const { rows: history } = await db.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 40',
      [conversation.id]
    );

    const { reply, emergency } = await sendMessage({ userProfile: profile, message: req.body.message, history });

    const userRole = 'user';
    const assistantRole = 'assistant';
    await db.query(
      'INSERT INTO messages (conversation_id, user_id, role, content) VALUES ($1,$2,$3,$4)',
      [conversation.id, req.user.id, userRole, req.body.message]
    );
    await db.query(
      'INSERT INTO messages (conversation_id, user_id, role, content, is_emergency) VALUES ($1,$2,$3,$4,$5)',
      [conversation.id, req.user.id, assistantRole, reply, emergency || false]
    );
    await db.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conversation.id]);

    return ok(res, { reply, emergency: emergency || false, conversationId: conversation.id });
  } catch (err) { return next(err); }
});

router.get('/history', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 100, 200);
    const offset = Number(req.query.offset) || 0;
    const { rows } = await db.query(
      'SELECT c.id AS conversation_id, c.title, c.mode, c.updated_at, m.role, m.content, m.is_emergency, m.created_at FROM conversations c JOIN messages m ON m.conversation_id = c.id WHERE c.user_id = $1 AND c.deleted_at IS NULL ORDER BY c.updated_at DESC, m.created_at ASC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    return ok(res, { messages: rows, limit, offset });
  } catch (err) { return next(err); }
});

module.exports = router;
