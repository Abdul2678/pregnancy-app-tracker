// routes/auth.js
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/refresh
// POST /api/auth/logout
// POST /api/auth/verify-email

const express  = require('express');
const bcrypt   = require('bcryptjs');
const { z }    = require('zod');
const crypto   = require('crypto');

const db = require('../../db');
const { validate }                          = require('../middleware/validate');
const { authLimiter }                       = require('../middleware/rateLimit');
const { authRequired, signAccessToken,
        signRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { ok, fail }                          = require('../middleware/respond');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email:       z.string().email().max(254),
  password:    z.string().min(8).max(128),
  displayName: z.string().min(1).max(120).optional(),
  accountType: z.enum(['primary', 'partner']).default('primary'),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function issueTokens(res, user) {
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshHash  = await bcrypt.hash(refreshToken, 10);

  await db.query(
    `UPDATE users SET refresh_token_hash = $1, updated_at = now() WHERE id = $2`,
    [refreshHash, user.id]
  );

  return ok(res, {
    accessToken,
    refreshToken,
    user: {
      id:          user.id,
      email:       user.email,
      displayName: user.display_name || null,
      accountType: user.account_type,
    },
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /register
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password, displayName, accountType } = req.body;
      const passwordHash  = await bcrypt.hash(password, 12);
      const verifyToken   = crypto.randomBytes(32).toString('hex');

      const { rows } = await db.query(
        `INSERT INTO users
           (email, password_hash, display_name, account_type, email_verify_token)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, display_name, account_type`,
        [email.toLowerCase(), passwordHash, displayName || null, accountType, verifyToken]
      );

      return issueTokens(res, rows[0]);
    } catch (err) {
      if (err.code === '23505') return fail(res, 'Email already registered', 409);
      return next(err);
    }
  }
);

// POST /login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const { rows } = await db.query(
        `SELECT id, email, display_name, password_hash, account_type, deleted_at
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (!rows.length || rows[0].deleted_at) {
        return fail(res, 'Invalid credentials', 401);
      }

      const ok2 = await bcrypt.compare(password, rows[0].password_hash);
      if (!ok2) return fail(res, 'Invalid credentials', 401);

      return issueTokens(res, rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

// POST /refresh
router.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        return fail(res, 'Invalid or expired refresh token', 401);
      }

      const { rows } = await db.query(
        `SELECT id, email, display_name, account_type, refresh_token_hash
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [payload.sub]
      );

      if (!rows.length || !rows[0].refresh_token_hash) {
        return fail(res, 'Invalid refresh token', 401);
      }

      const matches = await bcrypt.compare(refreshToken, rows[0].refresh_token_hash);
      if (!matches) return fail(res, 'Invalid refresh token', 401);

      return issueTokens(res, rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

// POST /logout  (authenticated — clears stored refresh token hash)
router.post('/logout', authRequired, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE users SET refresh_token_hash = NULL, updated_at = now() WHERE id = $1`,
      [req.user.id]
    );
    return ok(res, { message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
});

// POST /verify-email
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `UPDATE users
         SET email_verified = TRUE, email_verify_token = NULL, updated_at = now()
         WHERE email_verify_token = $1
         RETURNING id`,
        [req.body.token]
      );

      if (!rows.length) return fail(res, 'Invalid or expired verification token', 400);

      return ok(res, { message: 'Email verified successfully' });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /me  (lightweight check — returns current user from token)
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, display_name, account_type, email_verified, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );

    if (!rows.length) return fail(res, 'User not found', 404);

    return ok(res, {
      id:            rows[0].id,
      email:         rows[0].email,
      displayName:   rows[0].display_name,
      accountType:   rows[0].account_type,
      emailVerified: rows[0].email_verified,
      createdAt:     rows[0].created_at,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
