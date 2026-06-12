// services/notify.js
// Central push notification service.
//  - enqueue():     write a scheduled notification row
//  - sendNow():     enqueue + dispatch immediately
//  - dispatchDue(): send all due scheduled notifications via Expo Push API
//
// Tone rule: notifications are written like a caring friend — never urgency,
// never guilt, never marketing pressure.

const db = require('../db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Auto-migrations ───────────────────────────────────────────────────────────
// Extend the notifications.type CHECK to cover new event types, and add a
// granular notif_settings JSONB to user_profiles.

const DEFAULT_NOTIF_SETTINGS = {
  dailyTip: true,
  weeklyUpdate: true,
  appointmentReminder: true,
  moodCheckin: true,
  kickCelebration: true,
  contractionAlert: true,
  weekRollover: true,
  symptomFollowup: true,
  feedingReminder: false,       // postpartum, opt-in
  postpartumCheckin: true,
  frequency: 'all',             // all | important | minimal
};

async function ensureSchema() {
  await db.query(`
    ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS notif_settings JSONB
        NOT NULL DEFAULT '${JSON.stringify(DEFAULT_NOTIF_SETTINGS)}'::jsonb
  `);
  await db.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
  await db.query(`
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'weekly_update','daily_tip','appointment_reminder',
        'kick_reminder','medication_reminder','community_reply',
        'symptom_followup','mood_checkin','weight_checkin',
        'ppd_resource','emergency_followup','postpartum_update',
        'week_rollover','kick_celebration','contraction_alert',
        'feeding_reminder','postpartum_checkin','test'
      ))
  `);
}
ensureSchema().catch((err) => console.error('[notify] schema migration failed', err));

// ── Frequency tiers ───────────────────────────────────────────────────────────
// 'important' drops the nice-to-haves; 'minimal' keeps only safety + appointments.

const TYPE_TIER = {
  appointment_reminder: 'minimal',
  contraction_alert:    'minimal',
  ppd_resource:         'minimal',
  emergency_followup:   'minimal',
  mood_checkin:         'important',
  weekly_update:        'important',
  week_rollover:        'important',
  postpartum_checkin:   'important',
  feeding_reminder:     'important',
  daily_tip:            'all',
  kick_celebration:     'all',
  symptom_followup:     'all',
  test:                 'minimal',
};

const TYPE_SETTING_KEY = {
  daily_tip:            'dailyTip',
  weekly_update:        'weeklyUpdate',
  week_rollover:        'weekRollover',
  appointment_reminder: 'appointmentReminder',
  mood_checkin:         'moodCheckin',
  kick_celebration:     'kickCelebration',
  contraction_alert:    'contractionAlert',
  symptom_followup:     'symptomFollowup',
  feeding_reminder:     'feedingReminder',
  postpartum_checkin:   'postpartumCheckin',
};

function allowedByFrequency(type, frequency) {
  const tier = TYPE_TIER[type] ?? 'all';
  if (frequency === 'minimal')   return tier === 'minimal';
  if (frequency === 'important') return tier === 'minimal' || tier === 'important';
  return true;
}

/** Is `now` inside the user's quiet hours (local time)? */
function inQuietHours(profileRow, now = new Date()) {
  const { quiet_hours_start: start, quiet_hours_end: end, timezone } = profileRow;
  if (!start || !end) return false;
  let local;
  try {
    local = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now);
  } catch { local = now.toISOString().slice(11, 16); }
  const s = String(start).slice(0, 5);
  const e = String(end).slice(0, 5);
  // Quiet window may cross midnight (e.g. 22:00–07:00)
  return s <= e ? (local >= s && local < e) : (local >= s || local < e);
}

/** User's current local hour (0-23) and weekday (0=Sun) */
function localTime(timezone, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC', hour: 'numeric', hour12: false, weekday: 'short',
    }).formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10) % 24;
    const wd   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      .indexOf(parts.find((p) => p.type === 'weekday').value);
    return { hour, weekday: wd };
  } catch {
    return { hour: now.getUTCHours(), weekday: now.getUTCDay() };
  }
}

// ── Enqueue / send ────────────────────────────────────────────────────────────

/**
 * Write a notification row. Respects per-type toggles and frequency preference
 * at enqueue time. Returns the row id, or null if suppressed/duplicate.
 */
async function enqueue(userId, { type, title, body, data = {}, scheduledFor = new Date(), sourceType = null, sourceId = null, dedupeWindowHours = null }) {
  const { rows } = await db.query(
    `SELECT notif_pref, notif_settings, quiet_hours_start, quiet_hours_end, timezone, push_token
     FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  if (!rows.length) return null;
  const p = rows[0];

  if (p.notif_pref === 'off') return null;
  const settings = { ...DEFAULT_NOTIF_SETTINGS, ...(p.notif_settings || {}) };
  const key = TYPE_SETTING_KEY[type];
  if (key && settings[key] === false) return null;
  if (!allowedByFrequency(type, settings.frequency)) return null;

  // De-dupe: skip if same type already queued/sent within the window
  if (dedupeWindowHours) {
    const { rows: dupe } = await db.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1 AND type = $2 AND status IN ('scheduled','sent')
         AND created_at > now() - ($3 || ' hours')::interval
       LIMIT 1`,
      [userId, type, String(dedupeWindowHours)]
    );
    if (dupe.length) return null;
  }

  const { rows: ins } = await db.query(
    `INSERT INTO notifications (user_id, type, title, body, data, scheduled_for, source_type, source_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [userId, type, title, body, JSON.stringify(data), scheduledFor, sourceType, sourceId]
  );
  return ins[0].id;
}

/** Enqueue and immediately attempt dispatch (event-triggered notifications). */
async function sendNow(userId, payload) {
  const id = await enqueue(userId, payload);
  if (id) await dispatchDue();
  return id;
}

/** Send a batch of messages to the Expo Push API. */
async function expoPush(messages) {
  if (!messages.length) return [];
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const json = await res.json().catch(() => ({}));
  return json.data ?? [];
}

/**
 * Dispatch all notifications whose scheduled_for has passed.
 * Quiet hours: defer (leave scheduled) rather than drop.
 */
async function dispatchDue() {
  const { rows } = await db.query(
    `SELECT n.id, n.user_id, n.type, n.title, n.body, n.data,
            p.push_token, p.quiet_hours_start, p.quiet_hours_end, p.timezone, p.notif_pref
     FROM notifications n
     JOIN user_profiles p ON p.user_id = n.user_id
     WHERE n.status = 'scheduled' AND n.scheduled_for <= now()
     ORDER BY n.scheduled_for
     LIMIT 200`
  );
  if (!rows.length) return { sent: 0, deferred: 0, failed: 0 };

  let sent = 0, deferred = 0, failed = 0;
  const toSend = [];

  for (const n of rows) {
    if (n.notif_pref === 'off' || !n.push_token) {
      await db.query(`UPDATE notifications SET status = 'cancelled' WHERE id = $1`, [n.id]);
      continue;
    }
    if (n.type !== 'contraction_alert' && inQuietHours(n)) {
      deferred++; // dispatcher will retry next run; safety alerts bypass quiet hours
      continue;
    }
    toSend.push(n);
  }

  // Expo accepts batches of up to 100
  for (let i = 0; i < toSend.length; i += 100) {
    const batch = toSend.slice(i, i + 100);
    try {
      const tickets = await expoPush(batch.map((n) => ({
        to: n.push_token,
        title: n.title,
        body: n.body,
        data: { ...n.data, notificationId: n.id, type: n.type },
        sound: 'default',
      })));
      for (let j = 0; j < batch.length; j++) {
        const ticket = tickets[j];
        if (ticket && ticket.status === 'error') {
          failed++;
          await db.query(
            `UPDATE notifications SET status = 'failed', failure_reason = $2 WHERE id = $1`,
            [batch[j].id, ticket.message || 'expo error']
          );
        } else {
          sent++;
          await db.query(
            `UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`,
            [batch[j].id]
          );
        }
      }
    } catch (err) {
      console.error('[notify] expo push batch failed', err.message);
      failed += batch.length;
    }
  }

  return { sent, deferred, failed };
}

module.exports = {
  enqueue,
  sendNow,
  dispatchDue,
  localTime,
  inQuietHours,
  DEFAULT_NOTIF_SETTINGS,
};
