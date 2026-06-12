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
// Auto-migration: lockout, OTP reset, social login, deletion scheduling
// ---------------------------------------------------------------------------

async function ensureAuthColumns() {
  await db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS failed_login_count     SMALLINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reset_otp_hash         TEXT,
      ADD COLUMN IF NOT EXISTS reset_otp_expires      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reset_otp_attempts     SMALLINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS auth_provider          TEXT NOT NULL DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS provider_subject       TEXT,
      ADD COLUMN IF NOT EXISTS deletion_requested_at  TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS privacy_accepted_at    TIMESTAMPTZ
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_subject
      ON users (auth_provider, provider_subject)
      WHERE provider_subject IS NOT NULL
  `);
}
ensureAuthColumns().catch((err) => console.error('[auth] migration failed', err));

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES   = 15;

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
        `SELECT id, email, display_name, password_hash, account_type, deleted_at,
                failed_login_count, locked_until, deletion_requested_at
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (!rows.length || rows[0].deleted_at) {
        return fail(res, 'Invalid credentials', 401);
      }

      const user = rows[0];

      // Account lockout: 5 failed attempts → 15 minute lock
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const mins = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
        return fail(res, `Account temporarily locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`, 423);
      }

      const ok2 = await bcrypt.compare(password, user.password_hash);
      if (!ok2) {
        const failures = (user.failed_login_count || 0) + 1;
        const lock = failures >= MAX_FAILED_LOGINS
          ? `now() + interval '${LOCKOUT_MINUTES} minutes'`
          : 'NULL';
        await db.query(
          `UPDATE users SET failed_login_count = $2, locked_until = ${lock}, updated_at = now()
           WHERE id = $1`,
          [user.id, failures >= MAX_FAILED_LOGINS ? 0 : failures]
        );
        return fail(res, 'Invalid credentials', 401);
      }

      // Successful login: reset lockout counters
      await db.query(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = now()
         WHERE id = $1`,
        [user.id]
      );

      return issueTokens(res, user);
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

// ---------------------------------------------------------------------------
// Password reset — email OTP (6 digits, 10 min expiry)
// ---------------------------------------------------------------------------

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema  = z.object({
  email:       z.string().email(),
  otp:         z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

// POST /forgot-password — issue OTP. Always returns 200 (no account enumeration).
router.post('/forgot-password', authLimiter, validate(forgotSchema), async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const { rows } = await db.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (rows.length) {
      const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const otpHash = await bcrypt.hash(otp, 10);
      await db.query(
        `UPDATE users
         SET reset_otp_hash = $2, reset_otp_expires = now() + interval '10 minutes',
             reset_otp_attempts = 0, updated_at = now()
         WHERE id = $1`,
        [rows[0].id, otpHash]
      );
      // Email delivery: hook up your transactional email provider here.
      // The OTP is only ever logged in development.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[auth] password reset OTP for ${email}: ${otp}`);
      }
      // TODO: sendEmail(email, 'Your Bloom reset code', `Your code is ${otp}. It expires in 10 minutes.`)
    }

    return ok(res, { message: 'If that email is registered, a reset code has been sent.' });
  } catch (err) {
    return next(err);
  }
});

// POST /reset-password — verify OTP, set new password, revoke all sessions
router.post('/reset-password', authLimiter, validate(resetSchema), async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    const { rows } = await db.query(
      `SELECT id, reset_otp_hash, reset_otp_expires, reset_otp_attempts
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    const generic = () => fail(res, 'Invalid or expired code', 400);
    if (!rows.length) return generic();
    const u = rows[0];

    if (!u.reset_otp_hash || !u.reset_otp_expires || new Date(u.reset_otp_expires) < new Date()) {
      return generic();
    }
    if (u.reset_otp_attempts >= 5) {
      await db.query(`UPDATE users SET reset_otp_hash = NULL WHERE id = $1`, [u.id]);
      return fail(res, 'Too many attempts — request a new code', 429);
    }

    const matches = await bcrypt.compare(otp, u.reset_otp_hash);
    if (!matches) {
      await db.query(
        `UPDATE users SET reset_otp_attempts = reset_otp_attempts + 1 WHERE id = $1`,
        [u.id]
      );
      return generic();
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query(
      `UPDATE users
       SET password_hash = $2, reset_otp_hash = NULL, reset_otp_expires = NULL,
           reset_otp_attempts = 0, refresh_token_hash = NULL,
           failed_login_count = 0, locked_until = NULL, updated_at = now()
       WHERE id = $1`,
      [u.id, passwordHash]
    );

    return ok(res, { message: 'Password updated. Please sign in with your new password.' });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Social login — Apple Sign In + Google Sign In (no Facebook, by design)
// ---------------------------------------------------------------------------
// The client sends the provider's identity token; we verify its signature
// against the provider's published JWKS and extract a stable subject.

const socialSchema = z.object({
  provider:      z.enum(['apple', 'google']),
  identityToken: z.string().min(20),
  displayName:   z.string().max(120).optional(),  // Apple only sends name on first auth
});

const JWKS_URLS = {
  apple:  'https://appleid.apple.com/auth/keys',
  google: 'https://www.googleapis.com/oauth2/v3/certs',
};
const EXPECTED_ISS = {
  apple:  'https://appleid.apple.com',
  google: ['https://accounts.google.com', 'accounts.google.com'],
};

const jwksCache = {}; // provider → { keys, fetchedAt }

async function getJwks(provider) {
  const cached = jwksCache[provider];
  if (cached && Date.now() - cached.fetchedAt < 6 * 3600 * 1000) return cached.keys;
  const res = await fetch(JWKS_URLS[provider]);
  const { keys } = await res.json();
  jwksCache[provider] = { keys, fetchedAt: Date.now() };
  return keys;
}

async function verifySocialToken(provider, identityToken) {
  const jwt = require('jsonwebtoken');
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded) throw new Error('Malformed token');

  const keys = await getJwks(provider);
  const jwk = keys.find((k) => k.kid === decoded.header.kid);
  if (!jwk) throw new Error('Unknown signing key');

  const pem = crypto.createPublicKey({ key: jwk, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' });

  const audience = provider === 'apple'
    ? process.env.APPLE_BUNDLE_ID  || 'com.bloom.pregnancy'
    : process.env.GOOGLE_CLIENT_ID;

  const payload = jwt.verify(identityToken, pem, {
    algorithms: ['RS256'],
    audience: audience || undefined,
    issuer: EXPECTED_ISS[provider],
  });

  return { subject: payload.sub, email: payload.email || null };
}

// POST /social — sign in or register with Apple / Google
router.post('/social', authLimiter, validate(socialSchema), async (req, res, next) => {
  try {
    const { provider, identityToken, displayName } = req.body;

    let identity;
    try {
      identity = await verifySocialToken(provider, identityToken);
    } catch (err) {
      return fail(res, `Could not verify ${provider} sign-in: ${err.message}`, 401);
    }

    // Existing account by provider subject
    let { rows } = await db.query(
      `SELECT id, email, display_name, account_type
       FROM users WHERE auth_provider = $1 AND provider_subject = $2 AND deleted_at IS NULL`,
      [provider, identity.subject]
    );

    // Link to existing email account if one exists
    if (!rows.length && identity.email) {
      const byEmail = await db.query(
        `UPDATE users SET auth_provider = $2, provider_subject = $3, updated_at = now()
         WHERE email = $1 AND deleted_at IS NULL
         RETURNING id, email, display_name, account_type`,
        [identity.email.toLowerCase(), provider, identity.subject]
      );
      rows = byEmail.rows;
    }

    // New account
    if (!rows.length) {
      const email = identity.email
        ? identity.email.toLowerCase()
        : `${provider}_${identity.subject}@private.bloom`; // Apple private relay may hide email
      const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      const inserted = await db.query(
        `INSERT INTO users (email, password_hash, display_name, account_type,
                            auth_provider, provider_subject, email_verified, privacy_accepted_at)
         VALUES ($1, $2, $3, 'primary', $4, $5, TRUE, now())
         RETURNING id, email, display_name, account_type`,
        [email, randomPw, displayName || null, provider, identity.subject]
      );
      rows = inserted.rows;
    }

    return issueTokens(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Privacy acceptance
// ---------------------------------------------------------------------------

// POST /accept-privacy — record acceptance timestamp (shown during onboarding)
router.post('/accept-privacy', authRequired, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE users SET privacy_accepted_at = now(), updated_at = now() WHERE id = $1`,
      [req.user.id]
    );
    return ok(res, { accepted: true });
  } catch (err) {
    return next(err);
  }
});

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
