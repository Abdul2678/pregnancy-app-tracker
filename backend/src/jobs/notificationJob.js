// jobs/notificationJob.js
// Two cron tasks:
//   1. Dispatcher  (every 5 min): send due scheduled notifications via Expo.
//   2. Enqueuer    (hourly):      queue time-based notifications per user,
//                                 honouring each user's local timezone.
//
// Time-based notifications:
//   - Daily tip            8am local, from push_notification_copy
//   - Weekly dev update    Monday 9am local
//   - Week rollover        9am local on the day the pregnancy week increments
//   - Mood nudge           6pm local if no mood log for 2+ days
//   - Postpartum check-in  9am local while postpartum_mode is on
//   - Feeding reminder     every 3h (daytime) when feedingReminder enabled
//   - Appointment reminders 24h and 1h before (checked every 15 min)

const cron = require('node-cron');
const db = require('../db');
const notify = require('../services/notify');

// ── Tip / copy helpers ────────────────────────────────────────────────────────

async function getDailyTipCopy(week, phase, language) {
  const { rows } = await db.query(
    `SELECT title, body FROM push_notification_copy
     WHERE week = $1 AND phase = $2 AND language IN ($3, 'en')
     ORDER BY (language = $3) DESC, random()
     LIMIT 1`,
    [week, phase, language || 'en']
  );
  return rows[0] ?? null;
}

// ── Hourly enqueuer ───────────────────────────────────────────────────────────

async function enqueueScheduled() {
  const { rows: users } = await db.query(`
    SELECT p.user_id, p.timezone, p.language, p.postpartum_mode, p.notif_settings,
           pr.current_week, pr.lmp_date, pr.due_date, pr.calculated_due_date
    FROM user_profiles p
    LEFT JOIN pregnancies pr ON pr.user_id = p.user_id AND pr.is_current = TRUE
    WHERE p.push_token IS NOT NULL AND p.notif_pref != 'off'
  `);

  for (const u of users) {
    const { hour, weekday } = notify.localTime(u.timezone);
    const phase = u.postpartum_mode ? 'newborn' : 'pregnancy';

    // Compute live week from due date (current_week column can be stale)
    let week = u.current_week ?? null;
    const due = u.due_date || u.calculated_due_date;
    if (due && !u.postpartum_mode) {
      const daysToDue = Math.round((new Date(due) - Date.now()) / 86400000);
      week = Math.min(42, Math.max(1, 40 - Math.ceil(daysToDue / 7)));
    }

    try {
      // Daily tip — 8am local
      if (hour === 8 && week != null) {
        const copy = await getDailyTipCopy(week, phase, u.language);
        if (copy) {
          await notify.enqueue(u.user_id, {
            type: 'daily_tip',
            title: copy.title,
            body: copy.body,
            data: { screen: 'home', tipWeek: week },
            dedupeWindowHours: 20,
          });
        }
      }

      // Weekly development update — Monday 9am local
      if (weekday === 1 && hour === 9 && !u.postpartum_mode && week != null) {
        await notify.enqueue(u.user_id, {
          type: 'weekly_update',
          title: 'A new week, a new milestone 🌱',
          body: `Your baby reached a new milestone this week. Tap to see what's happening in week ${week}.`,
          data: { screen: 'learn', week },
          dedupeWindowHours: 24 * 6,
        });
      }

      // Week rollover — 9am local on the exact day the week increments
      if (hour === 9 && due && !u.postpartum_mode && week != null) {
        const daysToDue = Math.round((new Date(due) - Date.now()) / 86400000);
        if (daysToDue % 7 === 0 && daysToDue >= 0) {
          await notify.enqueue(u.user_id, {
            type: 'week_rollover',
            title: `Welcome to week ${week} 💗`,
            body: 'A fresh week begins today — tap to see what\'s new for you and your baby.',
            data: { screen: 'home', week },
            dedupeWindowHours: 24 * 6,
          });
        }
      }

      // Mood nudge — 6pm local if no mood log for 2+ days
      if (hour === 18) {
        const { rows: mood } = await db.query(
          `SELECT 1 FROM mood_logs WHERE user_id = $1 AND created_at > now() - interval '2 days' LIMIT 1`,
          [u.user_id]
        );
        if (!mood.length) {
          await notify.enqueue(u.user_id, {
            type: 'mood_checkin',
            title: 'How are you feeling today? 💜',
            body: 'It\'s been a couple of days — a quick check-in can help you spot patterns. No pressure, just a moment for you.',
            data: { screen: 'track', tab: 'mood' },
            dedupeWindowHours: 44,
          });
        }
      }

      // Postpartum daily wellbeing check-in — 9am local
      if (hour === 9 && u.postpartum_mode) {
        await notify.enqueue(u.user_id, {
          type: 'postpartum_checkin',
          title: 'How are you recovering today? 🌸',
          body: 'Your healing matters as much as the baby\'s growth. Take 30 seconds to check in with yourself.',
          data: { screen: 'home' },
          dedupeWindowHours: 20,
        });
      }

      // Feeding reminder — every 3h between 7am–10pm, opt-in only
      if (u.postpartum_mode && hour >= 7 && hour <= 22 && hour % 3 === 1) {
        const settings = u.notif_settings || {};
        if (settings.feedingReminder === true) {
          await notify.enqueue(u.user_id, {
            type: 'feeding_reminder',
            title: 'Feeding time soon? 🍼',
            body: 'It may be around feeding time. Log it when you\'re ready — the timeline keeps track for you.',
            data: { screen: 'newborn-tracker' },
            dedupeWindowHours: 2,
          });
        }
      }
    } catch (err) {
      console.error(`[notificationJob] enqueue failed for user ${u.user_id}`, err.message);
    }
  }
}

// ── Appointment reminders (every 15 min) ──────────────────────────────────────

async function enqueueAppointmentReminders() {
  // 24h-ahead window and 1h-ahead window, each 15 minutes wide
  const windows = [
    { interval: '24 hours', label: 'tomorrow', dedupe: 'appt_24h' },
    { interval: '1 hour',   label: 'in about an hour', dedupe: 'appt_1h' },
  ];

  for (const w of windows) {
    const { rows } = await db.query(
      `SELECT a.id, a.user_id, a.title, a.scheduled_at
       FROM appointments a
       WHERE a.scheduled_at BETWEEN now() + interval '${w.interval}'
                                AND now() + interval '${w.interval}' + interval '15 minutes'
         AND a.status = 'scheduled' AND a.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = a.user_id AND n.source_id = a.id
             AND n.type = 'appointment_reminder'
             AND n.data->>'window' = $1
         )`,
      [w.dedupe]
    );

    for (const a of rows) {
      await notify.enqueue(a.user_id, {
        type: 'appointment_reminder',
        title: `Appointment ${w.label} 🗓️`,
        body: `"${a.title}" is coming up ${w.label}. Tap for the details and your question list.`,
        data: { screen: 'plan', appointmentId: a.id, window: w.dedupe },
        sourceType: 'appointment',
        sourceId: a.id,
      }).catch((err) => console.error('[notificationJob] appt reminder failed', err.message));
    }
  }
}

// ── Schedulers ────────────────────────────────────────────────────────────────

function scheduleNotificationJobs() {
  const tasks = [];

  // Dispatcher: every 5 minutes
  tasks.push(cron.schedule('*/5 * * * *', async () => {
    try {
      const r = await notify.dispatchDue();
      if (r.sent || r.failed) console.log(`[notificationJob] dispatched: ${JSON.stringify(r)}`);
    } catch (err) { console.error('[notificationJob] dispatch error', err.message); }
  }));

  // Enqueuer: top of every hour
  tasks.push(cron.schedule('0 * * * *', async () => {
    try { await enqueueScheduled(); }
    catch (err) { console.error('[notificationJob] enqueue error', err.message); }
  }));

  // Appointment reminders: every 15 minutes
  tasks.push(cron.schedule('*/15 * * * *', async () => {
    try { await enqueueAppointmentReminders(); }
    catch (err) { console.error('[notificationJob] appointment error', err.message); }
  }));

  console.log('[notificationJob] scheduled (dispatch 5m, enqueue 1h, appointments 15m)');
  return {
    stop: () => tasks.forEach((t) => t.stop()),
  };
}

module.exports = { scheduleNotificationJobs, enqueueScheduled, enqueueAppointmentReminders };
