// routes/privacy.js
// Privacy-first endpoints:
//   GET  /privacy/summary          — what we collect and why (plain language)
//   GET  /privacy/settings         — sharing toggles + analytics opt-out
//   PUT  /privacy/settings         — update (everything OFF by default)
//   GET  /privacy/export           — full data export (JSON download)
//   POST /privacy/delete-account   — 2-step: requires password / confirm phrase
//   POST /privacy/cancel-deletion  — undo within the 48h window
//   GET  /privacy/policy           — plain-language privacy policy text

const express = require('express');
const bcrypt  = require('bcryptjs');
const { z }   = require('zod');

const db = require('../../db');
const { validate }     = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { apiLimiter, authLimiter } = require('../middleware/rateLimit');
const { ok, fail }     = require('../middleware/respond');

const router = express.Router();

// ── Auto-migration ────────────────────────────────────────────────────────────

const DEFAULT_PRIVACY = {
  shareWithPartner:   false,  // controlled separately in partner settings too
  anonymisedResearch: false,  // aggregate, de-identified research
  analyticsOptOut:    false,  // true = no analytics at all, even anonymised
};

async function ensurePrivacyColumns() {
  await db.query(`
    ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS privacy_prefs JSONB
        NOT NULL DEFAULT '${JSON.stringify(DEFAULT_PRIVACY)}'::jsonb
  `);
}
ensurePrivacyColumns().catch((err) => console.error('[privacy] migration failed', err));

// ── What we collect (single source of truth, used by app + policy) ───────────

const DATA_SUMMARY = [
  {
    category: 'Account',
    what: 'Email address and an encrypted password (or your Apple/Google sign-in).',
    why: 'So you can log in and recover your account.',
    shared: 'Never.',
  },
  {
    category: 'Pregnancy details',
    what: 'Due date, pregnancy week, and details you choose to add (IVF, multiples, history).',
    why: 'To personalise weekly content, tips and the AI companion.',
    shared: 'Never, unless you invite a partner — and then only what you choose.',
  },
  {
    category: 'Health logs',
    what: 'Symptoms, mood, weight, kicks, contractions, newborn logs — only what you log.',
    why: 'To show your trends and power features like the GP summary.',
    shared: 'Never. Encrypted at rest.',
  },
  {
    category: 'AI conversations',
    what: 'Your chat messages with the Bloom companion.',
    why: 'To give helpful, contextual answers.',
    shared: 'Never sold, never used to advertise to you.',
  },
  {
    category: 'Device',
    what: 'A push notification token and your language/timezone settings.',
    why: 'To deliver notifications at the right local time, in your language.',
    shared: 'Never.',
  },
  {
    category: 'Analytics',
    what: 'Anonymous usage events with a random ID — no name, no email, no health data.',
    why: 'To learn which features help and which need fixing.',
    shared: 'Self-hosted — never sent to ad networks or data brokers. You can opt out entirely.',
  },
];

const POLICY_TEXT = `# Your data belongs to you

Bloom is built on one principle: pregnancy data is some of the most sensitive data
that exists, and it is yours.

## What we collect
- Your email and encrypted password — to sign you in.
- Your due date and the pregnancy details you choose to share — to personalise the app.
- The health logs you create (symptoms, mood, weight, kicks, contractions, newborn logs).
- Your chats with the Bloom AI companion.
- A push token, language and timezone — to send notifications at sensible local times.
- Anonymous usage analytics under a random ID (you can turn this off completely).

## What we will never do
- We will NEVER sell your data. Not to advertisers, not to data brokers, not to anyone.
- We will NEVER share your health data with insurers, employers or governments
  unless legally compelled by a valid court order — and we will notify you if the law allows.
- We do NOT use Facebook SDKs or any third-party tracker in the app.
- We do NOT use your data to train AI models.

## How your data is protected
- Health data is encrypted at rest (AES-256) and in transit (HTTPS/TLS).
- If you are in the EU, your data is stored on EU servers (GDPR).
- Optional Face ID / fingerprint lock protects the app on a shared phone.

## Your rights — always available, no support ticket needed
- **Download everything**: get a complete copy of your data from Privacy settings.
- **Delete everything**: delete your account in-app. All your data is permanently
  erased within 48 hours. No dark patterns, no retention "for business purposes".
- **Opt out of analytics**: even our anonymised analytics can be switched off.

## Partner sharing
If you invite a partner, they only ever see what you explicitly enable —
mood, weight and symptoms are each individually OFF by default.

Questions? privacy@bloom.app`;

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /summary
router.get('/summary', authRequired, apiLimiter, (req, res) =>
  ok(res, { summary: DATA_SUMMARY })
);

// GET /policy (public — shown during onboarding before an account exists)
router.get('/policy', (req, res) => ok(res, { policy: POLICY_TEXT }));

// GET /settings
router.get('/settings', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.privacy_prefs, u.deletion_requested_at
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const prefs = { ...DEFAULT_PRIVACY, ...(rows[0]?.privacy_prefs || {}) };
    return ok(res, {
      settings: prefs,
      deletionRequestedAt: rows[0]?.deletion_requested_at ?? null,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /settings
const settingsSchema = z.object({
  shareWithPartner:   z.boolean().optional(),
  anonymisedResearch: z.boolean().optional(),
  analyticsOptOut:    z.boolean().optional(),
});

router.put('/settings', authRequired, apiLimiter, validate(settingsSchema), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT privacy_prefs FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const merged = { ...DEFAULT_PRIVACY, ...(rows[0]?.privacy_prefs || {}), ...req.body };
    await db.query(
      `INSERT INTO user_profiles (user_id, privacy_prefs)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET privacy_prefs = $2, updated_at = now()`,
      [req.user.id, JSON.stringify(merged)]
    );
    return ok(res, { settings: merged });
  } catch (err) {
    return next(err);
  }
});

// GET /export — full data export as downloadable JSON
router.get('/export', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const uid = req.user.id;
    const q = (sql) => db.query(sql, [uid]).then((r) => r.rows).catch(() => []);

    const [
      user, profile, pregnancies, symptoms, moods, weights,
      kicks, contractions, appointments, chats, newbornLogs, notifications,
    ] = await Promise.all([
      q(`SELECT id, email, display_name, account_type, auth_provider, created_at FROM users WHERE id = $1`),
      q(`SELECT * FROM user_profiles WHERE user_id = $1`),
      q(`SELECT * FROM pregnancies WHERE user_id = $1`),
      q(`SELECT * FROM symptom_logs WHERE user_id = $1`),
      q(`SELECT * FROM mood_logs WHERE user_id = $1`),
      q(`SELECT * FROM weight_logs WHERE user_id = $1`),
      q(`SELECT * FROM kick_counter_sessions WHERE user_id = $1`),
      q(`SELECT * FROM contraction_sessions WHERE user_id = $1`),
      q(`SELECT * FROM appointments WHERE user_id = $1`),
      q(`SELECT id, role, content, created_at FROM messages WHERE user_id = $1 ORDER BY created_at`),
      q(`SELECT * FROM newborn_logs WHERE user_id = $1`),
      q(`SELECT id, type, title, body, sent_at, opened_at FROM notifications WHERE user_id = $1`),
    ]);

    // Strip server-side secrets from the profile dump
    const cleanProfile = (profile[0] || {});
    delete cleanProfile.push_token;

    const exportBundle = {
      exportedAt: new Date().toISOString(),
      format: 'Bloom data export v1 — everything we store about you.',
      account: user[0] || null,
      profile: cleanProfile,
      pregnancies, symptoms, moods, weights, kicks,
      contractions, appointments,
      aiConversations: chats,
      newbornLogs, notifications,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bloom-data-export-${Date.now()}.json"`);
    return res.send(JSON.stringify(exportBundle, null, 2));
  } catch (err) {
    return next(err);
  }
});

// POST /delete-account — step 2 of the in-app 2-step confirmation.
// Requires the password (email accounts) or the literal confirm phrase (social).
const deleteSchema = z.object({
  password: z.string().optional(),
  confirmPhrase: z.string().optional(),  // must be "DELETE" for social accounts
});

router.post('/delete-account', authRequired, authLimiter, validate(deleteSchema), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT password_hash, auth_provider FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );
    if (!rows.length) return fail(res, 'Account not found', 404);

    const u = rows[0];
    if (u.auth_provider === 'email') {
      if (!req.body.password) return fail(res, 'Password required', 400);
      const match = await bcrypt.compare(req.body.password, u.password_hash);
      if (!match) return fail(res, 'Incorrect password', 401);
    } else if (req.body.confirmPhrase !== 'DELETE') {
      return fail(res, 'Type DELETE to confirm', 400);
    }

    await db.query(
      `UPDATE users
       SET deletion_requested_at = now(), refresh_token_hash = NULL, updated_at = now()
       WHERE id = $1`,
      [req.user.id]
    );

    return ok(res, {
      message: 'Deletion scheduled. All your data will be permanently erased within 48 hours. Sign in before then to cancel.',
      eraseBy: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

// POST /cancel-deletion
router.post('/cancel-deletion', authRequired, apiLimiter, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE users SET deletion_requested_at = NULL, updated_at = now() WHERE id = $1`,
      [req.user.id]
    );
    return ok(res, { message: 'Deletion cancelled. Welcome back.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
