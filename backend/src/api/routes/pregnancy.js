// routes/pregnancy.js
// POST /api/pregnancy              — create / start new pregnancy
// GET  /api/pregnancy/current      — get current pregnancy + week content
// GET  /api/pregnancy/:id          — get specific pregnancy by id
// PUT  /api/pregnancy/:id          — update pregnancy details
// POST /api/pregnancy/:id/outcome  — record outcome (birth / loss)
// GET  /api/pregnancy/history      — all pregnancies for user

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }             = require('../middleware/validate');
const { authRequired }         = require('../middleware/auth');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimit');
const { ok, fail, notFound }   = require('../middleware/respond');
const { runOnboarding }        = require('../../services/onboarding');
const { upsertProfile }        = require('../../services/profiles');
const { getWeekContent }       = require('../../services/weeklyContent');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createPregnancySchema = z.object({
  // Date input
  dateInput:     z.string().min(1),
  dateType:      z.enum(['lmp', 'due_date', 'ivf_transfer']),
  // Pregnancy details
  isIvf:         z.boolean().default(false),
  isFirst:       z.boolean().default(true),
  previousCount: z.number().int().min(0).default(0),
  outcomes:      z.array(z.string()).default([]),
  isMultiples:   z.boolean().default(false),
  multiplesCount: z.number().int().min(1).max(8).default(1),
  // User context (also used for onboarding personalization)
  age:           z.number().int().min(13).max(80).optional(),
  country:       z.string().max(3).optional(),
  language:      z.string().max(10).optional(),
  goals:         z.array(z.string()).default([]),
  conditions:    z.array(z.string()).default([]),
  dietary:       z.array(z.string()).default([]),
  notifPref:     z.string().default('daily'),
});

const updatePregnancySchema = z.object({
  dueDate:       z.string().optional(),
  currentWeek:   z.number().int().min(0).max(45).optional(),
  highRiskFlag:  z.boolean().optional(),
  highRiskReason: z.string().optional().nullable(),
  contentTrack:  z.enum(['standard', 'high_risk', 'ivf', 'multiples']).optional(),
  birthDate:     z.string().optional().nullable(),
  birthWeightGrams: z.number().int().positive().optional().nullable(),
  birthLengthCm: z.number().positive().optional().nullable(),
  birthType:     z.enum(['vaginal', 'c_section', 'vbac', 'assisted']).optional().nullable(),
  birthNotes:    z.string().max(2000).optional().nullable(),
});

const outcomeSchema = z.object({
  outcome:      z.enum(['live_birth', 'stillbirth', 'miscarriage', 'termination', 'ectopic']),
  birthDate:    z.string().optional(),
  birthWeightGrams: z.number().int().positive().optional().nullable(),
  birthLengthCm:    z.number().positive().optional().nullable(),
  birthType:    z.enum(['vaginal', 'c_section', 'vbac', 'assisted']).optional().nullable(),
  birthNotes:   z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateWeek(lmpDate) {
  const days = Math.floor((Date.now() - new Date(lmpDate).getTime()) / 86_400_000);
  return Math.min(Math.max(Math.floor(days / 7), 0), 45);
}

function calculateDueDateFromLmp(lmpDate) {
  const due = new Date(lmpDate);
  due.setDate(due.getDate() + 280);
  return due.toISOString().split('T')[0];
}

function calculateDueDateFromIvf(transferDate) {
  const due = new Date(transferDate);
  due.setDate(due.getDate() + 263);  // ~38 weeks from transfer
  return due.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /  — create pregnancy + run AI onboarding
router.post(
  '/',
  authRequired,
  aiLimiter,
  validate(createPregnancySchema),
  async (req, res, next) => {
    try {
      const b = req.body;

      // Derive dates
      let lmpDate, dueDate;
      if (b.dateType === 'lmp') {
        lmpDate = b.dateInput;
        dueDate = calculateDueDateFromLmp(lmpDate);
      } else if (b.dateType === 'due_date') {
        dueDate = b.dateInput;
        // Estimate LMP
        const d = new Date(dueDate);
        d.setDate(d.getDate() - 280);
        lmpDate = d.toISOString().split('T')[0];
      } else {
        // ivf_transfer
        dueDate = calculateDueDateFromIvf(b.dateInput);
        lmpDate = null;
      }

      const currentWeek = lmpDate ? calculateWeek(lmpDate) : 0;
      const trimester   = currentWeek <= 13 ? 1 : currentWeek <= 26 ? 2 : 3;

      // Mark any existing current pregnancy as not current
      await db.query(
        `UPDATE pregnancies SET is_current = FALSE WHERE user_id = $1 AND is_current = TRUE`,
        [req.user.id]
      );

      // Create pregnancy record
      const { rows: [pregnancy] } = await db.query(
        `INSERT INTO pregnancies
           (user_id, lmp_date, due_date, ivf_transfer_date, calculated_due_date,
            current_week, trimester, is_ivf, is_multiples, multiples_count,
            is_first_pregnancy, previous_count, previous_outcomes,
            is_current, outcome)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE,'ongoing')
         RETURNING *`,
        [
          req.user.id,
          lmpDate,
          dueDate,
          b.dateType === 'ivf_transfer' ? b.dateInput : null,
          dueDate,
          currentWeek,
          trimester,
          b.isIvf,
          b.isMultiples,
          b.multiplesCount,
          b.isFirst,
          b.previousCount,
          JSON.stringify(b.outcomes),
        ]
      );

      // Run AI onboarding personalization
      const profile = await runOnboarding({
        ...b,
        dateInput: b.dateInput,
        dateType:  b.dateType,
      });

      // Update notify_doctor on pregnancy
      await db.query(
        `UPDATE pregnancies SET notify_doctor = $1, notify_doctor_reason = $2 WHERE id = $3`,
        [profile.notifyDoctor || false, profile.notifyDoctorReason || null, pregnancy.id]
      );

      // Upsert user profile
      await upsertProfile(req.user.id, {
        ...profile,
        country:  b.country,
        language: b.language,
      });

      return ok(res, {
        pregnancy: {
          id:           pregnancy.id,
          currentWeek,
          trimester,
          dueDate,
          lmpDate,
          isIvf:        b.isIvf,
          isMultiples:  b.isMultiples,
          contentTrack: profile.contentTrack || 'standard',
          highRiskFlag: profile.highRiskFlag || false,
        },
        onboarding: {
          message:            profile.onboardingMessage,
          suggestedFirstAction: profile.suggestedFirstAction,
          featurePriorities:  profile.featurePriorities,
          notifyDoctor:       profile.notifyDoctor,
          notifyDoctorReason: profile.notifyDoctorReason,
        },
      }, 201);
    } catch (err) {
      return next(err);
    }
  }
);

// GET /current
router.get('/current', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, up.language, up.content_track
       FROM pregnancies p
       LEFT JOIN user_profiles up ON up.user_id = p.user_id
       WHERE p.user_id = $1 AND p.is_current = TRUE AND p.deleted_at IS NULL
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) return ok(res, null);

    const p = rows[0];

    // Auto-advance week if we have an LMP date
    let currentWeek = p.current_week || 0;
    if (p.lmp_date) {
      const live = calculateWeek(p.lmp_date);
      if (live !== currentWeek) {
        currentWeek = live;
        const trimester = live <= 13 ? 1 : live <= 26 ? 2 : 3;
        await db.query(
          `UPDATE pregnancies SET current_week = $1, trimester = $2, updated_at = now() WHERE id = $3`,
          [live, trimester, p.id]
        );
      }
    }

    // Fetch this week's cached content
    const weekContent = await getWeekContent({
      week:     currentWeek,
      track:    p.content_track || 'standard',
      language: p.language || 'en',
      phase:    'pregnancy',
    });

    return ok(res, {
      id:             p.id,
      currentWeek,
      trimester:      p.trimester,
      dueDate:        p.due_date,
      lmpDate:        p.lmp_date,
      isIvf:          p.is_ivf,
      isMultiples:    p.is_multiples,
      multiplesCount: p.multiples_count,
      isFirstPregnancy: p.is_first_pregnancy,
      highRiskFlag:   p.high_risk_flag,
      highRiskReason: p.high_risk_reason,
      contentTrack:   p.content_track || 'standard',
      notifyDoctor:   p.notify_doctor,
      outcome:        p.outcome,
      weekContent,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /history
router.get('/history', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, current_week, trimester, due_date, lmp_date, is_ivf,
              is_first_pregnancy, high_risk_flag, content_track, outcome,
              birth_date, is_current, created_at
       FROM pregnancies
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return ok(res, { pregnancies: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /:id
router.get('/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM pregnancies WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return notFound(res, 'Pregnancy');
    return ok(res, rows[0]);
  } catch (err) {
    return next(err);
  }
});

// PUT /:id
router.put(
  '/:id',
  authRequired,
  apiLimiter,
  validate(updatePregnancySchema),
  async (req, res, next) => {
    try {
      const b = req.body;

      // Verify ownership
      const { rows: existing } = await db.query(
        `SELECT id FROM pregnancies WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (!existing.length) return notFound(res, 'Pregnancy');

      const sets   = [];
      const params = [req.params.id];
      let   idx    = 2;

      const fields = {
        due_date:          b.dueDate,
        current_week:      b.currentWeek,
        high_risk_flag:    b.highRiskFlag,
        high_risk_reason:  b.highRiskReason,
        content_track:     b.contentTrack,
        birth_date:        b.birthDate,
        birth_weight_grams: b.birthWeightGrams,
        birth_length_cm:   b.birthLengthCm,
        birth_type:        b.birthType,
        birth_notes:       b.birthNotes,
      };

      for (const [col, val] of Object.entries(fields)) {
        if (val !== undefined) {
          sets.push(`${col} = $${idx}`);
          params.push(val);
          idx++;
        }
      }

      if (sets.length === 0) return fail(res, 'No fields to update', 400);
      sets.push('updated_at = now()');

      const { rows } = await db.query(
        `UPDATE pregnancies SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        params
      );

      return ok(res, rows[0]);
    } catch (err) {
      return next(err);
    }
  }
);

// POST /:id/outcome
router.post(
  '/:id/outcome',
  authRequired,
  apiLimiter,
  validate(outcomeSchema),
  async (req, res, next) => {
    try {
      const b = req.body;

      const { rows: existing } = await db.query(
        `SELECT id FROM pregnancies WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (!existing.length) return notFound(res, 'Pregnancy');

      const { rows } = await db.query(
        `UPDATE pregnancies SET
           outcome = $1, birth_date = $2, birth_weight_grams = $3,
           birth_length_cm = $4, birth_type = $5, birth_notes = $6,
           is_current = CASE WHEN $1 = 'live_birth' THEN TRUE ELSE FALSE END,
           updated_at = now()
         WHERE id = $7
         RETURNING *`,
        [
          b.outcome,
          b.birthDate || null,
          b.birthWeightGrams || null,
          b.birthLengthCm || null,
          b.birthType || null,
          b.birthNotes || null,
          req.params.id,
        ]
      );

      // If live birth, switch user to postpartum mode
      if (b.outcome === 'live_birth' && b.birthDate) {
        await db.query(
          `UPDATE user_profiles
           SET postpartum_mode = TRUE, updated_at = now()
           WHERE user_id = $1`,
          [req.user.id]
        );
      }

      return ok(res, {
        pregnancy: rows[0],
        postpartumActivated: b.outcome === 'live_birth',
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
