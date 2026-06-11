// routes/partner.js

const express = require('express');
const { z }   = require('zod');
const crypto  = require('crypto');

const db = require('../../db');
const { validate }             = require('../middleware/validate');
const { authRequired }         = require('../middleware/auth');
const { apiLimiter, inviteLimiter } = require('../middleware/rateLimit');
const { ok, created, fail, notFound, forbidden } = require('../middleware/respond');
const { getProfile }           = require('../../services/profiles');
const { buildSystemPrompt }    = require('../../prompts/systemPrompt');
const { getWeekContent }       = require('../../services/weeklyContent');

const router = express.Router();

// Run migration once per boot to add privacy_json if missing
db.query(`
  ALTER TABLE user_partners
  ADD COLUMN IF NOT EXISTS privacy_json JSONB
  DEFAULT '{"shareMood":false,"shareWeight":false,"shareSymptoms":false}'
`).catch(() => {});

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  inviteEmail: z.string().email().max(254),
});

const acceptSchema = z.object({
  token: z.string().min(10),
  email:       z.string().email().optional(),
  password:    z.string().min(8).optional(),
  displayName: z.string().min(1).max(120).optional(),
});

const joinCodeSchema = z.object({
  code:        z.string().length(6).regex(/^\d{6}$/),
  email:       z.string().email(),
  password:    z.string().min(8),
  displayName: z.string().min(1).max(120).optional(),
});

const privacySchema = z.object({
  shareMood:     z.boolean().optional(),
  shareWeight:   z.boolean().optional(),
  shareSymptoms: z.boolean().optional(),
});

const voteSchema = z.object({
  status: z.enum(['loved', 'maybe', 'vetoed']),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /invite  (primary user sends invite to partner's email)
router.post('/invite', authRequired, inviteLimiter, validate(inviteSchema), async (req, res, next) => {
  try {
    if (req.user.accountType !== 'primary' && req.user.accountType !== 'admin') {
      return forbidden(res);
    }

    const { rows: existing } = await db.query(
      `SELECT id, status FROM user_partners WHERE primary_user_id = $1`,
      [req.user.id]
    );

    if (existing.length && existing[0].status === 'accepted') {
      return fail(res, 'You already have an accepted partner link. Revoke it first to invite someone new.', 409);
    }

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { rows: inviteeRows } = await db.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [req.body.inviteEmail.toLowerCase()]
    );
    const inviteeId = inviteeRows[0]?.id || null;

    const { rows: [link] } = await db.query(
      `INSERT INTO user_partners
         (primary_user_id, partner_user_id, invite_email, invite_token,
          invite_expires_at, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (primary_user_id) DO UPDATE SET
         partner_user_id   = EXCLUDED.partner_user_id,
         invite_email      = EXCLUDED.invite_email,
         invite_token      = EXCLUDED.invite_token,
         invite_expires_at = EXCLUDED.invite_expires_at,
         status            = 'pending',
         updated_at        = now()
       RETURNING *`,
      [req.user.id, inviteeId, req.body.inviteEmail.toLowerCase(), token, expiresAt]
    );

    return created(res, {
      inviteEmail:       req.body.inviteEmail,
      inviteToken:       token,
      expiresAt,
      alreadyHasAccount: !!inviteeId,
      message:           `Invite sent to ${req.body.inviteEmail}. They have 7 days to accept.`,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /code  — generate 6-digit code for in-app sharing
router.post('/code', authRequired, inviteLimiter, async (req, res, next) => {
  try {
    if (req.user.accountType !== 'primary' && req.user.accountType !== 'admin') {
      return forbidden(res);
    }

    const { rows: existing } = await db.query(
      `SELECT id, status FROM user_partners WHERE primary_user_id = $1`,
      [req.user.id]
    );
    if (existing.length && existing[0].status === 'accepted') {
      return fail(res, 'You already have a linked partner. Revoke first to generate a new code.', 409);
    }

    const code      = String(Math.floor(100000 + Math.random() * 900000));
    const fakeEmail = `CODE:${code}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await db.query(
      `INSERT INTO user_partners
         (primary_user_id, partner_user_id, invite_email, invite_token,
          invite_expires_at, status)
       VALUES ($1, NULL, $2, NULL, $3, 'pending')
       ON CONFLICT (primary_user_id) DO UPDATE SET
         partner_user_id   = NULL,
         invite_email      = EXCLUDED.invite_email,
         invite_token      = NULL,
         invite_expires_at = EXCLUDED.invite_expires_at,
         status            = 'pending',
         updated_at        = now()`,
      [req.user.id, fakeEmail, expiresAt]
    );

    return ok(res, { code, expiresAt });
  } catch (err) {
    return next(err);
  }
});

// POST /join  — partner enters 6-digit code and creates account
router.post('/join', apiLimiter, validate(joinCodeSchema), async (req, res, next) => {
  try {
    const fakeEmail = `CODE:${req.body.code}`;

    const { rows: linkRows } = await db.query(
      `SELECT * FROM user_partners
       WHERE invite_email = $1
         AND status = 'pending'
         AND invite_expires_at > now()`,
      [fakeEmail]
    );

    if (!linkRows.length) {
      return fail(res, 'Invalid or expired code', 400);
    }

    const link = linkRows[0];

    // Check email not already used
    const { rows: emailCheck } = await db.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [req.body.email.toLowerCase()]
    );
    if (emailCheck.length) {
      return fail(res, 'Email already registered. Sign in instead.', 409);
    }

    const bcrypt = require('bcryptjs');
    const hash   = await bcrypt.hash(req.body.password, 12);

    const { rows: newUser } = await db.query(
      `INSERT INTO users (email, password_hash, display_name, account_type)
       VALUES ($1,$2,$3,'partner')
       RETURNING id`,
      [req.body.email.toLowerCase(), hash, req.body.displayName || null]
    );

    const partnerId = newUser[0].id;

    await db.query(
      `UPDATE user_partners
       SET partner_user_id = $1, status = 'accepted',
           invite_email = $2, invite_token = NULL, updated_at = now()
       WHERE id = $3`,
      [partnerId, req.body.email.toLowerCase(), link.id]
    );

    return ok(res, { joined: true, message: 'Account created! Sign in with your email and password.' });
  } catch (err) {
    if (err.code === '23505') return fail(res, 'Email already registered', 409);
    return next(err);
  }
});

// POST /accept  (partner accepts the invite via email token)
router.post('/accept', apiLimiter, validate(acceptSchema), async (req, res, next) => {
  try {
    const { rows: linkRows } = await db.query(
      `SELECT * FROM user_partners
       WHERE invite_token = $1
         AND status = 'pending'
         AND invite_expires_at > now()`,
      [req.body.token]
    );

    if (!linkRows.length) return fail(res, 'Invalid or expired invite token', 400);

    const link = linkRows[0];
    let partnerId;

    if (link.partner_user_id) {
      partnerId = link.partner_user_id;
    } else {
      if (!req.body.email || !req.body.password) {
        return fail(res, 'email and password required to create a partner account', 400);
      }
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(req.body.password, 12);
      const { rows: newUser } = await db.query(
        `INSERT INTO users (email, password_hash, display_name, account_type)
         VALUES ($1,$2,$3,'partner')
         RETURNING id`,
        [req.body.email.toLowerCase(), hash, req.body.displayName || null]
      );
      partnerId = newUser[0].id;
    }

    await db.query(
      `UPDATE user_partners
       SET partner_user_id = $1, status = 'accepted',
           invite_token = NULL, updated_at = now()
       WHERE id = $2`,
      [partnerId, link.id]
    );

    return ok(res, { accepted: true, primaryUserId: link.primary_user_id, partnerUserId: partnerId });
  } catch (err) {
    if (err.code === '23505') return fail(res, 'Email already registered', 409);
    return next(err);
  }
});

// GET /  — link status
router.get('/', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT up.id, up.status, up.invite_email, up.invite_expires_at,
              up.primary_user_id, up.partner_user_id,
              up.privacy_json,
              pu.display_name AS primary_display_name,
              pa.display_name AS partner_display_name
       FROM user_partners up
       LEFT JOIN users pu ON pu.id = up.primary_user_id
       LEFT JOIN users pa ON pa.id = up.partner_user_id
       WHERE (up.primary_user_id = $1 OR up.partner_user_id = $1)
         AND up.status != 'revoked'
       ORDER BY up.updated_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) return ok(res, { linked: false, link: null });

    const row = rows[0];
    // Don't expose raw invite_email if it's a CODE: marker
    if (row.invite_email && row.invite_email.startsWith('CODE:')) {
      row.invite_email = null;
    }

    return ok(res, { linked: row.status === 'accepted', link: row });
  } catch (err) {
    return next(err);
  }
});

// PUT /privacy  — primary user updates sharing preferences
router.put('/privacy', authRequired, apiLimiter, validate(privacySchema), async (req, res, next) => {
  try {
    if (req.user.accountType !== 'primary' && req.user.accountType !== 'admin') {
      return forbidden(res);
    }

    const { rows } = await db.query(
      `SELECT privacy_json FROM user_partners WHERE primary_user_id = $1 AND status = 'accepted'`,
      [req.user.id]
    );

    if (!rows.length) return notFound(res, 'Partner link');

    const current = rows[0].privacy_json || { shareMood: false, shareWeight: false, shareSymptoms: false };
    const updated = { ...current, ...req.body };

    await db.query(
      `UPDATE user_partners SET privacy_json = $1, updated_at = now()
       WHERE primary_user_id = $2`,
      [JSON.stringify(updated), req.user.id]
    );

    return ok(res, { privacy: updated });
  } catch (err) {
    return next(err);
  }
});

// DELETE /  — revoke link (primary user only)
router.delete('/', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE user_partners SET status = 'revoked', invite_token = NULL, updated_at = now()
       WHERE primary_user_id = $1`,
      [req.user.id]
    );
    if (!rowCount) return notFound(res, 'Partner link');
    return ok(res, { revoked: true });
  } catch (err) {
    return next(err);
  }
});

// GET /view  — partner's read-only pregnancy summary (privacy-gated)
router.get('/view', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows: linkRows } = await db.query(
      `SELECT primary_user_id, privacy_json FROM user_partners
       WHERE partner_user_id = $1 AND status = 'accepted'`,
      [req.user.id]
    );

    if (!linkRows.length) return fail(res, 'No accepted partner link found for your account', 403);

    const primaryUserId = linkRows[0].primary_user_id;
    const privacy       = linkRows[0].privacy_json || { shareMood: false, shareWeight: false, shareSymptoms: false };

    const [profile, pregRows, recentMoods, recentKicks, weightRows] = await Promise.all([
      getProfile(primaryUserId),
      db.query(
        `SELECT id, current_week, trimester, due_date, lmp_date,
                high_risk_flag, content_track, is_ivf, is_multiples
         FROM pregnancies
         WHERE user_id = $1 AND is_current = TRUE LIMIT 1`,
        [primaryUserId]
      ),
      privacy.shareMood
        ? db.query(
            `SELECT mood, mood_score, logged_at FROM mood_logs
             WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 5`,
            [primaryUserId]
          )
        : { rows: [] },
      db.query(
        `SELECT kick_count, target_kicks, target_met, started_at
         FROM kick_counter_sessions
         WHERE user_id = $1 ORDER BY started_at DESC LIMIT 3`,
        [primaryUserId]
      ),
      privacy.shareWeight
        ? db.query(
            `SELECT weight_kg, logged_at FROM weight_logs
             WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1`,
            [primaryUserId]
          ).catch(() => ({ rows: [] }))
        : { rows: [] },
    ]);

    const preg = pregRows.rows[0];
    let weekContent = null;
    if (preg) {
      weekContent = await getWeekContent({
        week:     preg.current_week || 0,
        track:    preg.content_track || 'standard',
        language: profile?.language || 'en',
        phase:    'pregnancy',
      });
    }

    return ok(res, {
      pregnancy:    preg || null,
      currentWeek:  preg?.current_week,
      dueDate:      preg?.due_date,
      recentMoods:  recentMoods.rows,
      recentKicks:  recentKicks.rows,
      latestWeight: weightRows.rows[0] || null,
      weekContent,
      privacy,
      partnerSystemPrompt: buildSystemPrompt({ ...(profile || {}), partnerMode: true }),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /checklist  — hospital bag checklist using primary user's data
router.get('/checklist', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows: linkRows } = await db.query(
      `SELECT primary_user_id FROM user_partners
       WHERE partner_user_id = $1 AND status = 'accepted'`,
      [req.user.id]
    );
    if (!linkRows.length) return fail(res, 'No partner link', 403);

    const primaryUserId = linkRows[0].primary_user_id;

    // Proxy the hospital-bag feature as the primary user
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const profile   = await getProfile(primaryUserId);

    const systemPrompt = buildSystemPrompt({ ...(profile || {}), partnerMode: false });
    const userMsg = 'Generate a comprehensive hospital bag checklist in JSON. Return ONLY JSON with this exact shape: {"checklist":{"categories":[{"name":"string","items":[{"item":"string","essential":true,"note":"string|null"}]}]}}';

    const msg = await client.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMsg }],
    });

    let parsed;
    try {
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = { checklist: { categories: [] } };
    }

    return ok(res, parsed);
  } catch (err) {
    return next(err);
  }
});

// GET /names  — primary user's baby name shortlist for partner voting
router.get('/names', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows: linkRows } = await db.query(
      `SELECT primary_user_id FROM user_partners
       WHERE partner_user_id = $1 AND status = 'accepted'`,
      [req.user.id]
    );
    if (!linkRows.length) return fail(res, 'No partner link', 403);

    const primaryUserId = linkRows[0].primary_user_id;

    const { rows } = await db.query(
      `SELECT id, name, gender_fit, origin, meaning, pronunciation, syllables, status, partner_status
       FROM baby_name_shortlist
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [primaryUserId]
    ).catch(() => ({ rows: [] }));

    return ok(res, { names: rows });
  } catch (err) {
    return next(err);
  }
});

// PUT /names/:id/vote  — partner votes on a name
router.put('/names/:id/vote', authRequired, apiLimiter, validate(voteSchema), async (req, res, next) => {
  try {
    const { rows: linkRows } = await db.query(
      `SELECT primary_user_id FROM user_partners
       WHERE partner_user_id = $1 AND status = 'accepted'`,
      [req.user.id]
    );
    if (!linkRows.length) return fail(res, 'No partner link', 403);

    const primaryUserId = linkRows[0].primary_user_id;

    const { rows } = await db.query(
      `UPDATE baby_name_shortlist
       SET partner_status = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [req.body.status, req.params.id, primaryUserId]
    ).catch(() => ({ rows: [] }));

    if (!rows.length) return notFound(res, 'Name');
    return ok(res, { name: rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
