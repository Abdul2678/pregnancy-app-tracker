// api/routes/auth.js
// POST /register, POST /login, POST /refresh

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const db = require('../../db');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120).optional(),
  accountType: z.enum(['primary', 'partner']).optional(),
  partnerOfUserId: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

async function issueTokens(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  await db.query(`UPDATE users SET refresh_token_hash = $1, updated_at = now() WHERE id = $2`, [
    refreshHash,
    user.id,
  ]);
  return res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, accountType: user.account_type },
  });
}

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, displayName, accountType, partnerOfUserId } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, display_name, account_type, partner_of_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, account_type`,
      [email.toLowerCase(), passwordHash, displayName || null, accountType || 'primary', partnerOfUserId || null]
    );
    return issueTokens(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return next(err);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      `SELECT id, email, password_hash, account_type FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    return issueTokens(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.post('/refresh', authLimiter, validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { rows } = await db.query(
      `SELECT id, email, account_type, refresh_token_hash FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!rows.length || !rows[0].refresh_token_hash) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const matches = await bcrypt.compare(refreshToken, rows[0].refresh_token_hash);
    if (!matches) return res.status(401).json({ error: 'Invalid refresh token' });

    return issueTokens(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
