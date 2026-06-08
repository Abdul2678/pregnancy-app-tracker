// routes/appointments.js
// GET    /api/appointments           — list (with upcoming/past filter)
// POST   /api/appointments           — create
// GET    /api/appointments/:id       — get single
// PUT    /api/appointments/:id       — update
// DELETE /api/appointments/:id       — soft delete
// POST   /api/appointments/:id/complete
//
// GET    /api/appointments/medications       — list medication reminders
// POST   /api/appointments/medications       — create reminder
// PUT    /api/appointments/medications/:id   — update
// DELETE /api/appointments/medications/:id   — soft delete
// POST   /api/appointments/medications/:id/log — log a taken/skipped dose

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }             = require('../middleware/validate');
const { authRequired }         = require('../middleware/auth');
const { apiLimiter }           = require('../middleware/rateLimit');
const { ok, created, fail, notFound } = require('../middleware/respond');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const APPT_TYPES = ['general','midwife','obgyn','ultrasound','blood_test',
  'glucose_test','gbs_test','anatomy_scan','nst','postpartum_checkup',
  'pediatric','dental','other'];

const createApptSchema = z.object({
  title:           z.string().min(1).max(200),
  type:            z.enum(APPT_TYPES).default('general'),
  scheduledAt:     z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  timezone:        z.string().max(64).default('UTC'),
  locationName:    z.string().max(200).optional().nullable(),
  locationAddress: z.string().max(500).optional().nullable(),
  providerName:    z.string().max(200).optional().nullable(),
  reminderMinutes: z.array(z.number().int().min(0)).default([1440, 60]),
  notes:           z.string().max(2000).optional().nullable(),
});

const updateApptSchema = createApptSchema.partial().omit({ type: true });

const apptFilterSchema = z.object({
  filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const MED_CATEGORIES = ['supplement','vitamin','prescription','otc','herbal'];
const MED_FREQUENCIES = ['once','daily','twice_daily','three_times','weekly','as_needed'];

const createMedSchema = z.object({
  name:         z.string().min(1).max(200),
  category:     z.enum(MED_CATEGORIES).default('supplement'),
  dosage:       z.string().max(100).optional().nullable(),
  instructions: z.string().max(500).optional().nullable(),
  frequency:    z.enum(MED_FREQUENCIES).default('daily'),
  timesOfDay:   z.array(z.string().regex(/^\d{2}:\d{2}$/)).default(['08:00']),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  prescribedBy: z.string().max(200).optional().nullable(),
});

const medLogSchema = z.object({
  takenAt:    z.string().datetime().optional(),
  skipped:    z.boolean().default(false),
  skipReason: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function currentPregnancyId(userId) {
  const { rows } = await db.query(
    'SELECT id FROM pregnancies WHERE user_id = $1 AND is_current = TRUE LIMIT 1',
    [userId]
  );
  return rows[0]?.id || null;
}

async function ownedAppt(apptId, userId) {
  const { rows } = await db.query(
    'SELECT id FROM appointments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [apptId, userId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// APPOINTMENTS
// ---------------------------------------------------------------------------

router.get('/', authRequired, apiLimiter, validate(apptFilterSchema, 'query'), async (req, res, next) => {
  try {
    const { filter, limit, offset } = req.query;
    const now = new Date().toISOString();

    const whereTime = filter === 'upcoming'
      ? `AND a.scheduled_at >= $3`
      : filter === 'past'
        ? `AND a.scheduled_at < $3`
        : '';

    const params = filter === 'all'
      ? [req.user.id, limit, offset]
      : [req.user.id, limit, offset, now];

    const whereTimeOffset = filter === 'all' ? '' : whereTime;

    const { rows } = await db.query(
      `SELECT a.id, a.title, a.type, a.scheduled_at, a.duration_minutes,
              a.timezone, a.location_name, a.provider_name, a.status,
              a.pregnancy_week, a.notes, a.reminder_minutes, a.created_at
       FROM appointments a
       WHERE a.user_id = $1 AND a.deleted_at IS NULL
         ${whereTimeOffset}
       ORDER BY a.scheduled_at ${filter === 'past' ? 'DESC' : 'ASC'}
       LIMIT $2 OFFSET $3`,
      params
    );

    return ok(res, { appointments: rows, filter, limit, offset });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authRequired, apiLimiter, validate(createApptSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const pregnancyId = await currentPregnancyId(req.user.id);

    // Derive pregnancy week from scheduled_at if we have LMP
    let pregnancyWeek = null;
    if (pregnancyId) {
      const { rows: pregRows } = await db.query('SELECT lmp_date, current_week FROM pregnancies WHERE id = $1', [pregnancyId]);
      if (pregRows[0]?.lmp_date) {
        const days = Math.floor((new Date(b.scheduledAt) - new Date(pregRows[0].lmp_date)) / 86_400_000);
        pregnancyWeek = Math.max(0, Math.min(45, Math.floor(days / 7)));
      } else {
        pregnancyWeek = pregRows[0]?.current_week || null;
      }
    }

    const { rows: [appt] } = await db.query(
      `INSERT INTO appointments
         (user_id, pregnancy_id, title, type, scheduled_at, duration_minutes,
          timezone, location_name, location_address, provider_name,
          reminder_minutes, notes, pregnancy_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        req.user.id, pregnancyId, b.title, b.type, b.scheduledAt,
        b.durationMinutes, b.timezone, b.locationName || null,
        b.locationAddress || null, b.providerName || null,
        JSON.stringify(b.reminderMinutes), b.notes || null, pregnancyWeek,
      ]
    );

    return created(res, { appointment: appt });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM appointments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return notFound(res, 'Appointment');
    return ok(res, { appointment: rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', authRequired, apiLimiter, validate(updateApptSchema), async (req, res, next) => {
  try {
    if (!(await ownedAppt(req.params.id, req.user.id))) return notFound(res, 'Appointment');

    const b = req.body;
    const sets   = [];
    const params = [req.params.id];
    let   idx    = 2;

    const fields = {
      title:           b.title,
      scheduled_at:    b.scheduledAt,
      duration_minutes: b.durationMinutes,
      timezone:        b.timezone,
      location_name:   b.locationName,
      location_address: b.locationAddress,
      provider_name:   b.providerName,
      reminder_minutes: b.reminderMinutes !== undefined ? JSON.stringify(b.reminderMinutes) : undefined,
      notes:           b.notes,
      status:          b.status,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${col} = $${idx}`); params.push(val); idx++; }
    }

    if (!sets.length) return fail(res, 'No fields to update', 400);
    sets.push('updated_at = now()');

    const { rows } = await db.query(
      `UPDATE appointments SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    return ok(res, { appointment: rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/complete', authRequired, apiLimiter, async (req, res, next) => {
  try {
    if (!(await ownedAppt(req.params.id, req.user.id))) return notFound(res, 'Appointment');

    const { rows } = await db.query(
      `UPDATE appointments
       SET status = 'completed', completed_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    return ok(res, { appointment: rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE appointments SET deleted_at = now(), status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Appointment');
    return ok(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// MEDICATION REMINDERS
// ---------------------------------------------------------------------------

router.get('/medications', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const { rows } = await db.query(
      `SELECT id, name, category, dosage, instructions, frequency, times_of_day,
              start_date, end_date, is_active, prescribed_by, created_at
       FROM medication_reminders
       WHERE user_id = $1 AND deleted_at IS NULL
         ${activeOnly ? 'AND is_active = TRUE' : ''}
       ORDER BY created_at ASC`,
      [req.user.id]
    );
    return ok(res, { medications: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/medications', authRequired, apiLimiter, validate(createMedSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const pregnancyId = await currentPregnancyId(req.user.id);

    const { rows: [med] } = await db.query(
      `INSERT INTO medication_reminders
         (user_id, pregnancy_id, name, category, dosage, instructions,
          frequency, times_of_day, start_date, end_date, prescribed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user.id, pregnancyId, b.name, b.category,
        b.dosage || null, b.instructions || null,
        b.frequency, JSON.stringify(b.timesOfDay),
        b.startDate || new Date().toISOString().split('T')[0],
        b.endDate || null, b.prescribedBy || null,
      ]
    );

    return created(res, { medication: med });
  } catch (err) {
    return next(err);
  }
});

router.put('/medications/:id', authRequired, apiLimiter, validate(createMedSchema.partial()), async (req, res, next) => {
  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM medication_reminders WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return notFound(res, 'Medication reminder');

    const b = req.body;
    const sets   = [];
    const params = [req.params.id];
    let   idx    = 2;

    const fields = {
      name:         b.name,
      category:     b.category,
      dosage:       b.dosage,
      instructions: b.instructions,
      frequency:    b.frequency,
      times_of_day: b.timesOfDay !== undefined ? JSON.stringify(b.timesOfDay) : undefined,
      start_date:   b.startDate,
      end_date:     b.endDate,
      is_active:    b.isActive,
      prescribed_by: b.prescribedBy,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${col} = $${idx}`); params.push(val); idx++; }
    }

    if (!sets.length) return fail(res, 'No fields to update', 400);
    sets.push('updated_at = now()');

    const { rows } = await db.query(
      `UPDATE medication_reminders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    return ok(res, { medication: rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.delete('/medications/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE medication_reminders SET deleted_at = now(), is_active = FALSE
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Medication reminder');
    return ok(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/medications/:id/log', authRequired, apiLimiter, validate(medLogSchema), async (req, res, next) => {
  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM medication_reminders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return notFound(res, 'Medication reminder');

    const { rows: [log] } = await db.query(
      `INSERT INTO medication_logs (reminder_id, user_id, taken_at, skipped, skip_reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        req.params.id, req.user.id,
        req.body.takenAt || new Date().toISOString(),
        req.body.skipped, req.body.skipReason || null,
      ]
    );

    return created(res, { log });
  } catch (err) {
    return next(err);
  }
});

// GET /medications/:id/logs
router.get('/medications/:id/logs', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, taken_at, skipped, skip_reason, created_at
       FROM medication_logs
       WHERE reminder_id = $1 AND user_id = $2
       ORDER BY taken_at DESC LIMIT 90`,
      [req.params.id, req.user.id]
    );
    return ok(res, { logs: rows });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
