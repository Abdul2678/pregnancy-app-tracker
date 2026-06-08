// routes/postpartum.js
// POST /api/postpartum/activate, GET /api/postpartum/profile, PUT /api/postpartum/profile
// GET  /api/postpartum/newborn-week/:week
// POST/GET /api/postpartum/logs, GET /api/postpartum/logs/summary
// GET  /api/postpartum/ppd-status

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }       = require('../middleware/validate');
const { authRequired }   = require('../middleware/auth');
const { apiLimiter }     = require('../middleware/rateLimit');
const { ok, created, fail, notFound } = require('../middleware/respond');
const { getWeekContent } = require('../../services/weeklyContent');
const { getProfile }     = require('../../services/profiles');

const router = express.Router();

const activateSchema = z.object({
  birthDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  birthType:        z.enum(['vaginal','c_section','vbac','assisted']).optional(),
  feedingMethod:    z.enum(['breastfeeding','formula','mixed','unknown']).default('unknown'),
  babyName:         z.string().max(100).optional().nullable(),
  babySex:          z.enum(['male','female','intersex','unknown']).optional(),
  birthWeightGrams: z.number().int().positive().optional().nullable(),
  birthLengthCm:    z.number().positive().optional().nullable(),
});

const updateProfileSchema = z.object({
  feedingMethod:      z.enum(['breastfeeding','formula','mixed','unknown']).optional(),
  babyName:           z.string().max(100).optional().nullable(),
  babySex:            z.enum(['male','female','intersex','unknown']).optional(),
  cSectionIncisionOk: z.boolean().optional().nullable(),
  perinealHealingOk:  z.boolean().optional().nullable(),
  lochiaStoppedAt:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const newbornLogSchema = z.object({
  logType:  z.enum(['feeding','sleep','diaper','growth','other']),
  loggedAt: z.string().datetime().optional(),
  notes:    z.string().max(500).optional().nullable(),
  feedingType: z.enum(['breast_left','breast_right','both_breasts','formula','pumped']).optional(),
  feedingDurationMin: z.number().int().positive().optional().nullable(),
  feedingAmountMl: z.number().positive().optional().nullable(),
  sleepStart: z.string().datetime().optional().nullable(),
  sleepEnd:   z.string().datetime().optional().nullable(),
  sleepLocation: z.enum(['crib','bassinet','parent_bed','carrier','stroller','other']).optional(),
  sleepPosition: z.enum(['back','side','tummy']).optional(),
  diaperType: z.enum(['wet','dirty','both','dry']).optional(),
  stoolColor: z.enum(['black','dark_green','yellow','green','red','white','orange']).optional(),
  stoolConsistency: z.enum(['meconium','seedy','watery','soft','hard']).optional(),
  weightGrams: z.number().int().positive().optional().nullable(),
  lengthCm: z.number().positive().optional().nullable(),
  headCircumferenceCm: z.number().positive().optional().nullable(),
});

const pagination = z.object({
  logType: z.string().optional(),
  limit:   z.coerce.number().int().min(1).max(100).default(50),
  offset:  z.coerce.number().int().min(0).default(0),
});

function babyAgeDays(birthDate) { return Math.floor((Date.now() - new Date(birthDate).getTime()) / 86400000); }
function babyAgeWeeks(birthDate) { return Math.floor(babyAgeDays(birthDate) / 7); }
async function getPP(userId) {
  const { rows } = await db.query('SELECT * FROM postpartum_profiles WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

// POST /activate
router.post('/activate', authRequired, apiLimiter, validate(activateSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const { rows: pregRows } = await db.query(
      "UPDATE pregnancies SET outcome = 'live_birth', birth_date = $1, birth_type = $2, birth_weight_grams = $3, is_current = TRUE, updated_at = now() WHERE user_id = $4 AND is_current = TRUE RETURNING id",
      [b.birthDate, b.birthType || null, b.birthWeightGrams || null, req.user.id]
    );
    await db.query('UPDATE user_profiles SET postpartum_mode = TRUE, updated_at = now() WHERE user_id = $1', [req.user.id]);
    const nextEpds = new Date(); nextEpds.setDate(nextEpds.getDate() + 14);
    const { rows: [pp] } = await db.query(
      'INSERT INTO postpartum_profiles (user_id, pregnancy_id, birth_date, birth_type, feeding_method, baby_name, baby_sex, birth_weight_grams, birth_length_cm, current_baby_week, ppd_screen_due_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (user_id) DO UPDATE SET birth_date=$3,birth_type=$4,feeding_method=$5,baby_name=$6,baby_sex=$7,birth_weight_grams=$8,birth_length_cm=$9,current_baby_week=$10,ppd_screen_due_at=$11,updated_at=now() RETURNING *',
      [req.user.id, pregRows[0] && pregRows[0].id, b.birthDate, b.birthType || null, b.feedingMethod, b.babyName || null, b.babySex || null, b.birthWeightGrams || null, b.birthLengthCm || null, babyAgeWeeks(b.birthDate), nextEpds.toISOString()]
    );
    return created(res, { postpartumProfile: pp, babyAgeWeeks: babyAgeWeeks(b.birthDate), babyAgeDays: babyAgeDays(b.birthDate), message: 'Congratulations on the birth of your baby! Your app has switched to postpartum mode.' });
  } catch (err) { return next(err); }
});

// GET /profile
router.get('/profile', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const pp = await getPP(req.user.id);
    if (!pp) return notFound(res, 'Postpartum profile');
    const ageWeeks = Math.floor(babyAgeDays(pp.birth_date) / 7);
    if (ageWeeks !== pp.current_baby_week) {
      await db.query('UPDATE postpartum_profiles SET current_baby_week = $1, updated_at = now() WHERE user_id = $2', [ageWeeks, req.user.id]);
    }
    return ok(res, { ...pp, babyAgeWeeks: ageWeeks, babyAgeDays: babyAgeDays(pp.birth_date), epdsOverdue: pp.ppd_screen_due_at && new Date(pp.ppd_screen_due_at) < new Date() });
  } catch (err) { return next(err); }
});

// PUT /profile
router.put('/profile', authRequired, apiLimiter, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const pp = await getPP(req.user.id);
    if (!pp) return notFound(res, 'Postpartum profile');
    const b = req.body;
    const sets = []; const params = [req.user.id]; let idx = 2;
    const fields = { feeding_method: b.feedingMethod, baby_name: b.babyName, baby_sex: b.babySex, c_section_incision_ok: b.cSectionIncisionOk, perineal_healing_ok: b.perinealHealingOk, lochia_stopped_at: b.lochiaStoppedAt };
    for (const [col, val] of Object.entries(fields)) { if (val !== undefined) { sets.push(col + ' = $' + idx); params.push(val); idx++; } }
    if (!sets.length) return fail(res, 'No fields to update', 400);
    sets.push('updated_at = now()');
    const { rows } = await db.query('UPDATE postpartum_profiles SET ' + sets.join(', ') + ' WHERE user_id = $1 RETURNING *', params);
    return ok(res, rows[0]);
  } catch (err) { return next(err); }
});

// GET /newborn-week/:week
router.get('/newborn-week/:week', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const week = Number(req.params.week);
    if (!Number.isInteger(week) || week < 0 || week > 52) return fail(res, 'Week must be 0-52', 400);
    const profile = await getProfile(req.user.id);
    const content = await getWeekContent({ week: Math.min(week, 12), track: 'standard', language: (profile && profile.language) || 'en', phase: 'newborn' });
    return ok(res, { week, content });
  } catch (err) { return next(err); }
});

// POST /logs
router.post('/logs', authRequired, apiLimiter, validate(newbornLogSchema), async (req, res, next) => {
  try {
    const pp = await getPP(req.user.id);
    if (!pp) return fail(res, 'Postpartum profile not found. Activate postpartum mode first.', 400);
    const b = req.body;
    const loggedAt = b.loggedAt || new Date().toISOString();
    const ageDays = babyAgeDays(pp.birth_date);
    const sleepDurationMin = (b.sleepStart && b.sleepEnd) ? Math.round((new Date(b.sleepEnd) - new Date(b.sleepStart)) / 60000) : null;
    const { rows: [log] } = await db.query(
      'INSERT INTO newborn_logs (user_id, postpartum_id, log_type, baby_age_days, notes, logged_at, feeding_type, feeding_duration_min, feeding_amount_ml, sleep_start, sleep_end, sleep_duration_min, sleep_location, sleep_position, diaper_type, stool_color, stool_consistency, weight_grams, length_cm, head_circumference_cm) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *',
      [req.user.id, pp.id, b.logType, ageDays, b.notes || null, loggedAt, b.feedingType || null, b.feedingDurationMin || null, b.feedingAmountMl || null, b.sleepStart || null, b.sleepEnd || null, sleepDurationMin, b.sleepLocation || null, b.sleepPosition || null, b.diaperType || null, b.stoolColor || null, b.stoolConsistency || null, b.weightGrams || null, b.lengthCm || null, b.headCircumferenceCm || null]
    );
    return created(res, { log });
  } catch (err) { return next(err); }
});

// GET /logs
router.get('/logs', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { logType, limit, offset } = req.query;
    const { rows } = await db.query(
      'SELECT id, log_type, baby_age_days, feeding_type, feeding_duration_min, feeding_amount_ml, sleep_start, sleep_end, sleep_duration_min, sleep_position, diaper_type, stool_color, weight_grams, notes, logged_at FROM newborn_logs WHERE user_id = $1' + (logType ? ' AND log_type = $4' : '') + ' ORDER BY logged_at DESC LIMIT $2 OFFSET $3',
      logType ? [req.user.id, limit, offset, logType] : [req.user.id, limit, offset]
    );
    return ok(res, { logs: rows, limit, offset });
  } catch (err) { return next(err); }
});

// GET /logs/summary
router.get('/logs/summary', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [feeds, sleepRows, diapers] = await Promise.all([
      db.query("SELECT COUNT(*) AS count, COALESCE(SUM(feeding_duration_min),0) AS total_minutes, COALESCE(SUM(feeding_amount_ml),0) AS total_ml FROM newborn_logs WHERE user_id = $1 AND log_type = 'feeding' AND DATE(logged_at) = $2::date", [req.user.id, today]),
      db.query("SELECT COALESCE(SUM(sleep_duration_min),0) AS total_sleep_minutes, COUNT(*) AS nap_count FROM newborn_logs WHERE user_id = $1 AND log_type = 'sleep' AND DATE(logged_at) = $2::date", [req.user.id, today]),
      db.query("SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE diaper_type='wet') AS wet, COUNT(*) FILTER (WHERE diaper_type IN ('dirty','both')) AS dirty FROM newborn_logs WHERE user_id = $1 AND log_type = 'diaper' AND DATE(logged_at) = $2::date", [req.user.id, today]),
    ]);
    return ok(res, {
      date: today,
      feeds: { count: parseInt(feeds.rows[0].count), totalMinutes: parseInt(feeds.rows[0].total_minutes), totalMl: parseFloat(feeds.rows[0].total_ml) },
      sleep: { totalMinutes: parseInt(sleepRows.rows[0].total_sleep_minutes), napCount: parseInt(sleepRows.rows[0].nap_count), totalHours: +(parseInt(sleepRows.rows[0].total_sleep_minutes) / 60).toFixed(1) },
      diapers: { total: parseInt(diapers.rows[0].count), wet: parseInt(diapers.rows[0].wet), dirty: parseInt(diapers.rows[0].dirty) },
    });
  } catch (err) { return next(err); }
});

// GET /ppd-status
router.get('/ppd-status', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const pp = await getPP(req.user.id);
    if (!pp) return ok(res, { active: false });
    const epdsOverdue = pp.ppd_screen_due_at && new Date(pp.ppd_screen_due_at) < new Date();
    const { rows: lastEpds } = await db.query("SELECT epds_total, risk_level, epds_taken_at FROM mood_logs WHERE user_id = $1 AND mood = 'epds_screening' ORDER BY epds_taken_at DESC LIMIT 1", [req.user.id]);
    return ok(res, { active: true, epdsOverdue, epdsScreenDueAt: pp.ppd_screen_due_at, lastScore: pp.ppd_last_score, highRisk: pp.ppd_high_risk, lastScreening: lastEpds.rows[0] || null });
  } catch (err) { return next(err); }
});

module.exports = router;
