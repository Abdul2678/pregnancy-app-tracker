// routes/partner.js
// POST /api/partner/invite     — primary user invites a partner by email
// POST /api/partner/accept     — partner accepts invite using token
// GET  /api/partner            — get link status
// DELETE /api/partner          — revoke partner link
// GET  /api/partner/view       — partner's read-only pregnancy summary view

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

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  inviteEmail: z.string().email().max(254),
});

const acceptSchema = z.object({
  token: z.string().min(10),
  // New account fields if partner doesn't have an account yet
  email:       z.string().email().optional(),
  password:    z.string().min(8).optional(),
  displayName: z.string().min(1).max(120).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /invite  (primary user sends invite to partner's email)
router.post('/invite', authRequired, inviteLimiter, validate(inviteSchema), async (req, res, next) => {
  try {
    // Only primary accounts can invite
    if (req.user.accountType !== 'primary' && req.user.accountType !== 'admin') {
      return forbidden(res);
    }

    // Check if already linked
    const { rows: existing } = await db.query(
      `SELECT id, status FROM user_partners WHERE primary_user_id = $1`,
      [req.user.id]
    );

    if (existing.length && existing[0].status === 'accepted') {
      return fail(res, 'You already have an accepted partner link. Revoke it first to invite someone new.', 409);
    }

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Check if invitee already has an account
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

    // In production: send email with invite link containing the token
    // For now, return the token so it can be tested
    return created(res, {
      inviteEmail:   req.body.inviteEmail,
      inviteToken:   token,    // remove from prod response; send by email
      expiresAt,
      alreadyHasAccount: !!inviteeId,
      message: `Invite sent to ${req.body.inviteEmail}. They have 7 days to accept.`,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /accept  (partner accepts the invite)
router.post('/accept', apiLimiter, validate(acceptSchema), async (req, res, next) => {
  try {
    const { rows: linkRows } = await db.query(
      `SELECT * FROM user_partners
       WHERE invite_token = $1
         AND status = 'pending'
         AND invite_expires_at > now()`,
      [req.body.token]
    );

    if (!linkRows.length) {
      return fail(res, 'Invalid or expired invite token', 400);
    }

    const link = linkRows[0];

    let partnerId;

    // If partner already has an account, use it
    if (link.partner_user_id) {
      partnerId = link.partner_user_id;
    } else {
      // Create new partner account
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

    // Activate link
    await db.query(
      `UPDATE user_partners
       SET partner_user_id = $1, status = 'accepted',
           invite_token = NULL, updated_at = now()
       WHERE id = $2`,
      [partnerId, link.id]
    );

    return ok(res, {
      accepted:       true,
      primaryUserId:  link.primary_user_id,
      partnerUserId:  partnerId,
    });
  } catch (err) {
    if (err.code === '23505') return fail(res, 'Email already registered', 409);
    return next(err);
  }
});

// GET /  — link status
router.get('/', authRequired, apiLimiter, async (req, res, next) => {
  try {
    // Could be the primary or the partner querying
    const { rows } = await db.query(
      `SELECT up.id, up.status, up.invite_email, up.invite_expires_at,
              up.primary_user_id, up.partner_user_id,
              pu.display_name AS primary_display_name,
              pa.display_name AS partner_display_name
       FROM user_partners up
       LEFT JOIN users pu ON pu.id = up.primary_user_id
       LEFT JOIN users pa ON pa.id = up.partner_user_id
       WHERE up.primary_user_id = $1 OR up.partner_user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) return ok(res, { linked: false, link: null });

    return ok(res, { linked: rows[0].status === 'accepted', link: rows[0] });
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

// GET /view  — partner's read-only pregnancy summary
// Accessible by the linked partner account
router.get('/view', authRequired, apiLimiter, async (req, res, next) => {
  try {
    // Find the primary user linked to this partner
    const { rows: linkRows } = await db.query(
      `SELECT primary_user_id FROM user_partners
       WHERE partner_user_id = $1 AND status = 'accepted'`,
      [req.user.id]
    );

    if (!linkRows.length) {
      return fail(res, 'No accepted partner link found for your account', 403);
    }

    const primaryUserId = linkRows[0].primary_user_id;

    const [profile, pregRows, recentMoods, recentKicks] = await Promise.all([
      getProfile(primaryUserId),
      db.query(
        `SELECT id, current_week, trimester, due_date, lmp_date,
                high_risk_flag, content_track, is_ivf, is_multiples
         FROM pregnancies
         WHERE user_id = $1 AND is_current = TRUE LIMIT 1`,
        [primaryUserId]
      ),
      db.query(
        `SELECT mood, mood_score, logged_at FROM mood_logs
         WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 5`,
        [primaryUserId]
      ),
      db.query(
        `SELECT kick_count, target_kicks, target_met, started_at
         FROM kick_counter_sessions
         WHERE user_id = $1 ORDER BY started_at DESC LIMIT 3`,
        [primaryUserId]
      ),
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

    // Build partner system prompt context
    const systemPrompt = buildSystemPrompt({ ...(profile || {}), partnerMode: true });

    return ok(res, {
      // What a partner can see
      pregnancy: preg || null,
      currentWeek:  preg?.current_week,
      dueDate:      preg?.due_date,
      recentMoods:  recentMoods.rows,
      recentKicks:  recentKicks.rows,
      weekContent,
      partnerSystemPrompt: systemPrompt,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
