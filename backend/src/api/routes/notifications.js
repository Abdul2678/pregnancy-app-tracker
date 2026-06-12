// routes/notifications.js
// PUT  /api/notifications/push-token   — register / update push token
// PUT  /api/notifications/preferences  — update notification preferences
// GET  /api/notifications              — list user's notifications (inbox)
// PUT  /api/notifications/:id/read     — mark notification as read / opened
// PUT  /api/notifications/read-all     — mark all as read
// DELETE /api/notifications/:id        — dismiss notification

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }     = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { apiLimiter }   = require('../middleware/rateLimit');
const { ok, created, notFound } = require('../middleware/respond');
const notify = require('../../services/notify');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const pushTokenSchema = z.object({
  pushToken:    z.string().min(1).max(512),
  pushPlatform: z.enum(['ios', 'android', 'web']),
});

const preferencesSchema = z.object({
  notifPref:        z.enum(['off', 'daily', 'weekly']).optional(),
  quietHoursStart:  z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd:    z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  weeklyUpdate:     z.boolean().optional(),
  dailyTip:         z.boolean().optional(),
  appointmentAlert: z.boolean().optional(),
  kickReminder:     z.boolean().optional(),
  medicationAlert:  z.boolean().optional(),
  moodCheckin:      z.boolean().optional(),
});

const settingsSchema = z.object({
  dailyTip:            z.boolean().optional(),
  weeklyUpdate:        z.boolean().optional(),
  appointmentReminder: z.boolean().optional(),
  moodCheckin:         z.boolean().optional(),
  kickCelebration:     z.boolean().optional(),
  contractionAlert:    z.boolean().optional(),
  weekRollover:        z.boolean().optional(),
  symptomFollowup:     z.boolean().optional(),
  feedingReminder:     z.boolean().optional(),
  postpartumCheckin:   z.boolean().optional(),
  frequency:           z.enum(['all', 'important', 'minimal']).optional(),
  quietHoursStart:     z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd:       z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});

const listSchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  limit:      z.coerce.number().int().min(1).max(100).default(30),
  offset:     z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// PUT /push-token
router.put('/push-token', authRequired, apiLimiter, validate(pushTokenSchema), async (req, res, next) => {
  try {
    await db.query(
      `INSERT INTO user_profiles (user_id, push_token, push_platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET push_token = $2, push_platform = $3, updated_at = now()`,
      [req.user.id, req.body.pushToken, req.body.pushPlatform]
    );
    return ok(res, { registered: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /preferences
router.put('/preferences', authRequired, apiLimiter, validate(preferencesSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const sets   = [];
    const params = [req.user.id];
    let   idx    = 2;

    const fields = {
      notif_pref:       b.notifPref,
      quiet_hours_start: b.quietHoursStart,
      quiet_hours_end:  b.quietHoursEnd,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${col} = $${idx}`); params.push(val); idx++; }
    }

    if (sets.length > 0) {
      sets.push('updated_at = now()');
      await db.query(
        `INSERT INTO user_profiles (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET ${sets.join(', ')}`,
        params
      );
    }

    return ok(res, { updated: true });
  } catch (err) {
    return next(err);
  }
});

// GET /settings — granular notification settings
router.get('/settings', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT notif_settings, quiet_hours_start, quiet_hours_end, notif_pref
       FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const p = rows[0] || {};
    return ok(res, {
      settings: { ...notify.DEFAULT_NOTIF_SETTINGS, ...(p.notif_settings || {}) },
      quietHoursStart: p.quiet_hours_start ? String(p.quiet_hours_start).slice(0, 5) : null,
      quietHoursEnd:   p.quiet_hours_end   ? String(p.quiet_hours_end).slice(0, 5)   : null,
      enabled: p.notif_pref !== 'off',
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /settings — update granular settings + quiet hours
router.put('/settings', authRequired, apiLimiter, validate(settingsSchema), async (req, res, next) => {
  try {
    const { quietHoursStart, quietHoursEnd, ...toggles } = req.body;

    const { rows } = await db.query(
      `SELECT notif_settings FROM user_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const merged = { ...notify.DEFAULT_NOTIF_SETTINGS, ...(rows[0]?.notif_settings || {}), ...toggles };

    const sets   = ['notif_settings = $2', 'updated_at = now()'];
    const params = [req.user.id, JSON.stringify(merged)];
    let idx = 3;
    if (quietHoursStart !== undefined) { sets.push(`quiet_hours_start = $${idx++}`); params.push(quietHoursStart); }
    if (quietHoursEnd   !== undefined) { sets.push(`quiet_hours_end = $${idx++}`);   params.push(quietHoursEnd); }

    await db.query(
      `INSERT INTO user_profiles (user_id, notif_settings)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET ${sets.join(', ')}`,
      params
    );

    return ok(res, { settings: merged });
  } catch (err) {
    return next(err);
  }
});

// POST /test — send a test notification to this device (debugging)
router.post('/test', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const id = await notify.sendNow(req.user.id, {
      type: 'test',
      title: 'Test from Bloom 🌸',
      body: 'Notifications are working! You\'ll hear from us like a caring friend — never spam.',
      data: { screen: 'home' },
    });
    return ok(res, { sent: Boolean(id) });
  } catch (err) {
    return next(err);
  }
});

// GET /  (notification inbox)
router.get('/', authRequired, apiLimiter, validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const { unreadOnly, limit, offset } = req.query;

    const { rows } = await db.query(
      `SELECT id, type, title, body, data, scheduled_for, sent_at,
              opened_at, status, source_type, source_id
       FROM notifications
       WHERE user_id = $1
         ${unreadOnly ? 'AND opened_at IS NULL AND status = $4' : ''}
       ORDER BY sent_at DESC NULLS LAST, scheduled_for DESC
       LIMIT $2 OFFSET $3`,
      unreadOnly
        ? [req.user.id, limit, offset, 'sent']
        : [req.user.id, limit, offset]
    );

    const { rows: countRow } = await db.query(
      `SELECT COUNT(*) AS unread FROM notifications
       WHERE user_id = $1 AND opened_at IS NULL AND status = 'sent'`,
      [req.user.id]
    );

    return ok(res, {
      notifications: rows,
      unreadCount:   parseInt(countRow[0].unread),
      limit,
      offset,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /:id/read
router.put('/:id/read', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE notifications SET opened_at = now(), updated_at = now()
       WHERE id = $1 AND user_id = $2 AND opened_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Notification');
    return ok(res, { read: true });
  } catch (err) {
    return next(err);
  }
});

// PUT /read-all
router.put('/read-all', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE notifications SET opened_at = now(), updated_at = now()
       WHERE user_id = $1 AND opened_at IS NULL`,
      [req.user.id]
    );
    return ok(res, { markedRead: rowCount });
  } catch (err) {
    return next(err);
  }
});

// DELETE /:id
router.delete('/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE notifications SET status = 'cancelled', updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Notification');
    return ok(res, { dismissed: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
