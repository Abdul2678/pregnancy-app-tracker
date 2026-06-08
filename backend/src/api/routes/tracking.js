// routes/tracking.js
// POST/GET/DELETE  /api/tracking/symptoms
// POST/GET         /api/tracking/mood
// POST             /api/tracking/mood/epds
// POST/GET         /api/tracking/weight
// POST/PUT/GET     /api/tracking/kicks/sessions[/:id]
// POST/POST/PUT/GET /api/tracking/contractions/sessions[/:id/events|/close]
// GET              /api/tracking/summary

const express  = require('express');
const { z }    = require('zod');

const db = require('../../db');
const { validate }               = require('../middleware/validate');
const { authRequired }           = require('../middleware/auth');
const { aiLimiter, apiLimiter }  = require('../middleware/rateLimit');
const { ok, created, notFound }  = require('../middleware/respond');
const { triageSymptom }          = require('../../services/symptomTriage');
const { buildMentalHealthPrompt }  = require('../../prompts/mentalHealthPrompt');
const { buildWeightGuidancePrompt } = require('../../prompts/weightGuidancePrompt');
const { buildContractionPrompt } = require('../../prompts/contractionPrompt');
const { jsonCall }               = require('../../lib/claude');
const { getProfile }             = require('../../services/profiles');

const router = express.Router();

const pagination = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const symptomSchema = z.object({
  symptomName:   z.string().min(1).max(200),
  symptomRaw:    z.string().max(2000).optional().nullable(),
  severity:      z.number().int().min(1).max(5),
  durationHours: z.number().min(0).max(720).optional().nullable(),
  bodyLocation:  z.string().max(200).optional().nullable(),
  notes:         z.string().max(2000).optional().nullable(),
});

const moodSchema = z.object({
  mood:      z.string().min(1).max(100),
  moodScore: z.number().int().min(1).max(10).optional(),
  emotions:  z.array(z.string()).default([]),
  note:      z.string().max(2000).optional().nullable(),
});

const epdsSchema = z.object({
  responses: z.array(z.object({
    q:     z.number().int().min(1).max(10),
    score: z.number().int().min(0).max(3),
  })).length(10),
});

const weightSchema = z.object({
  weightKg: z.number().positive().max(500),
  notes:    z.string().max(500).optional().nullable(),
});

const kickSessionSchema = z.object({
  targetKicks: z.number().int().min(1).max(50).default(10),
  position:    z.enum(['left_side','right_side','sitting','standing']).optional(),
});

const addKickSchema = z.object({
  kickTime: z.string().datetime().optional(),
  notes:    z.string().max(500).optional().nullable(),
});

const contractionSessionSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
});

const contractionEventSchema = z.object({
  startTime:   z.string().datetime(),
  endTime:     z.string().datetime().optional().nullable(),
  durationSec: z.number().positive().optional().nullable(),
  intensity:   z.number().int().min(1).max(5).optional(),
  notes:       z.string().max(500).optional().nullable(),
});

async function currentPregnancy(userId) {
  const { rows } = await db.query(
    'SELECT id, current_week, trimester FROM pregnancies WHERE user_id = $1 AND is_current = TRUE LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

// SYMPTOMS
router.post('/symptoms', authRequired, aiLimiter, validate(symptomSchema), async (req, res, next) => {
  try {
    const [profile, preg] = await Promise.all([getProfile(req.user.id), currentPregnancy(req.user.id)]);
    const result = await triageSymptom({
      userId: req.user.id, profile: profile || {}, pregnancyId: preg && preg.id,
      symptomName: req.body.symptomName, symptomRaw: req.body.symptomRaw,
      severity: req.body.severity, durationHours: req.body.durationHours,
      bodyLocation: req.body.bodyLocation, notes: req.body.notes,
    });
    return created(res, { symptom: result, triage: result.triage_result });
  } catch (err) { return next(err); }
});

router.get('/symptoms', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const { rows } = await db.query(
      'SELECT id, symptom_name, symptom_raw, severity, duration_hours, body_location, notes, pregnancy_week, triage_result, is_emergency, logged_at FROM symptom_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    return ok(res, { symptoms: rows, limit, offset });
  } catch (err) { return next(err); }
});

router.delete('/symptoms/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM symptom_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rowCount) return notFound(res, 'Symptom log');
    return ok(res, { deleted: true });
  } catch (err) { return next(err); }
});

// MOOD
router.post('/mood', authRequired, aiLimiter, validate(moodSchema), async (req, res, next) => {
  try {
    const [profile, preg] = await Promise.all([getProfile(req.user.id), currentPregnancy(req.user.id)]);
    const { rows: recentRows } = await db.query(
      'SELECT mood, mood_score, note, logged_at FROM mood_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 7',
      [req.user.id]
    );
    const { system, user: userPrompt } = buildMentalHealthPrompt({
      user: profile || {}, mood: req.body.mood, moodScore: req.body.moodScore,
      note: req.body.note, recentMoods: recentRows, isPostpartum: !!(profile && profile.postpartum),
    });
    const analysis = await jsonCall({ system, userPrompt, maxTokens: 600 });
    const { rows: [entry] } = await db.query(
      'INSERT INTO mood_logs (user_id, pregnancy_id, mood, mood_score, emotions, note, pregnancy_week, is_postpartum, risk_level, analysis, ppd_flag) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [
        req.user.id, preg && preg.id, req.body.mood, req.body.moodScore || null,
        JSON.stringify(req.body.emotions), req.body.note || null,
        preg && preg.current_week, profile && profile.postpartum,
        analysis.riskLevel || 'low', JSON.stringify(analysis), analysis.ppdFlag || false,
      ]
    );
    return created(res, { mood: entry, analysis });
  } catch (err) { return next(err); }
});

router.get('/mood', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const { rows } = await db.query(
      'SELECT id, mood, mood_score, emotions, note, pregnancy_week, is_postpartum, risk_level, ppd_flag, epds_total, logged_at FROM mood_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    return ok(res, { moods: rows, limit, offset });
  } catch (err) { return next(err); }
});

router.post('/mood/epds', authRequired, apiLimiter, validate(epdsSchema), async (req, res, next) => {
  try {
    const total = req.body.responses.reduce((sum, r) => sum + r.score, 0);
    const ppdFlag = total >= 10;
    const risk = total >= 13 ? 'high' : total >= 10 ? 'moderate' : 'low';
    const { rows: [entry] } = await db.query(
      "INSERT INTO mood_logs (user_id, mood, mood_score, note, epds_responses, epds_total, epds_taken_at, is_postpartum, risk_level, ppd_flag) VALUES ($1,'epds_screening',NULL,'EPDS screening',$2,$3,now(),TRUE,$4,$5) RETURNING *",
      [req.user.id, JSON.stringify(req.body.responses), total, risk, ppdFlag]
    );
    if (ppdFlag) {
      await db.query('UPDATE postpartum_profiles SET ppd_last_score = $1, ppd_high_risk = $2, updated_at = now() WHERE user_id = $3', [total, ppdFlag, req.user.id]);
    }
    return created(res, {
      total, ppdFlag, riskLevel: risk, entry,
      message: ppdFlag
        ? 'Your score suggests you may be experiencing some difficulties. Please speak with your healthcare provider — support is available and you are not alone.'
        : 'Thank you for completing this check-in. Your wellbeing matters.',
    });
  } catch (err) { return next(err); }
});

// WEIGHT
router.post('/weight', authRequired, aiLimiter, validate(weightSchema), async (req, res, next) => {
  try {
    const [profile, preg] = await Promise.all([getProfile(req.user.id), currentPregnancy(req.user.id)]);
    const { system, user: userPrompt } = buildWeightGuidancePrompt({ user: profile || {}, weightKg: req.body.weightKg });
    const guidance = await jsonCall({ system, userPrompt, maxTokens: 600 });
    const { rows: pRow } = await db.query('SELECT height_cm FROM user_profiles WHERE user_id = $1', [req.user.id]);
    const h = pRow[0] && pRow[0].height_cm;
    const bmiAtLog = h ? +(req.body.weightKg / ((h / 100) ** 2)).toFixed(1) : null;
    const { rows: [entry] } = await db.query(
      'INSERT INTO weight_logs (user_id, pregnancy_id, weight_kg, pregnancy_week, bmi_at_log, guidance, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.user.id, preg && preg.id, req.body.weightKg, preg && preg.current_week, bmiAtLog, JSON.stringify(guidance), req.body.notes || null]
    );
    return created(res, { weight: entry, guidance });
  } catch (err) { return next(err); }
});

router.get('/weight', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const { rows } = await db.query(
      'SELECT id, weight_kg, pregnancy_week, bmi_at_log, notes, logged_at FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    return ok(res, { weights: rows, limit, offset });
  } catch (err) { return next(err); }
});

// KICK COUNTER
router.post('/kicks/sessions', authRequired, apiLimiter, validate(kickSessionSchema), async (req, res, next) => {
  try {
    const preg = await currentPregnancy(req.user.id);
    const { rows: [session] } = await db.query(
      'INSERT INTO kick_counter_sessions (user_id, pregnancy_id, pregnancy_week, target_kicks, position) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, preg && preg.id, preg && preg.current_week, req.body.targetKicks, req.body.position || null]
    );
    return created(res, { session });
  } catch (err) { return next(err); }
});

router.put('/kicks/sessions/:id', authRequired, apiLimiter, validate(addKickSchema), async (req, res, next) => {
  try {
    const { rows: existing } = await db.query('SELECT * FROM kick_counter_sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!existing.length) return notFound(res, 'Kick session');
    const session = existing[0];
    const kickTime = req.body.kickTime || new Date().toISOString();
    const kicks = (session.kick_times || []).concat([kickTime]);
    const count = kicks.length;
    const targetMet = count >= session.target_kicks;
    const metAt = (targetMet && !session.target_met) ? kickTime : session.target_met_at;
    const { rows: [updated] } = await db.query(
      'UPDATE kick_counter_sessions SET kick_times = $1, kick_count = $2, target_met = $3, target_met_at = $4, updated_at = now() WHERE id = $5 RETURNING *',
      [JSON.stringify(kicks), count, targetMet, metAt, req.params.id]
    );
    return ok(res, { session: updated, targetJustMet: targetMet && !session.target_met });
  } catch (err) { return next(err); }
});

router.get('/kicks', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const { rows } = await db.query(
      'SELECT id, pregnancy_week, started_at, ended_at, kick_count, target_kicks, target_met, duration_minutes, position FROM kick_counter_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    return ok(res, { sessions: rows, limit, offset });
  } catch (err) { return next(err); }
});

// CONTRACTIONS
router.post('/contractions/sessions', authRequired, apiLimiter, validate(contractionSessionSchema), async (req, res, next) => {
  try {
    const preg = await currentPregnancy(req.user.id);
    const { rows: [session] } = await db.query(
      'INSERT INTO contraction_sessions (user_id, pregnancy_id, pregnancy_week, notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, preg && preg.id, preg && preg.current_week, req.body.notes || null]
    );
    return created(res, { session });
  } catch (err) { return next(err); }
});

router.post('/contractions/sessions/:id/events', authRequired, aiLimiter, validate(contractionEventSchema), async (req, res, next) => {
  try {
    const { rows: sessionRows } = await db.query('SELECT * FROM contraction_sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!sessionRows.length) return notFound(res, 'Contraction session');
    const b = req.body;
    let durationSec = b.durationSec || null;
    if (!durationSec && b.endTime) durationSec = Math.round((new Date(b.endTime) - new Date(b.startTime)) / 1000);
    const { rows: prev } = await db.query('SELECT start_time FROM contraction_events WHERE session_id = $1 ORDER BY start_time DESC LIMIT 1', [req.params.id]);
    const intervalSec = prev.length ? Math.round((new Date(b.startTime) - new Date(prev[0].start_time)) / 1000) : null;
    const { rows: [event] } = await db.query(
      'INSERT INTO contraction_events (session_id, user_id, start_time, end_time, duration_sec, interval_sec, intensity, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [req.params.id, req.user.id, b.startTime, b.endTime || null, durationSec, intervalSec, b.intensity || null, b.notes || null]
    );
    const { rows: all } = await db.query('SELECT duration_sec, interval_sec FROM contraction_events WHERE session_id = $1', [req.params.id]);
    const durs = all.map((e) => e.duration_sec).filter(Boolean).map(Number);
    const ints = all.map((e) => e.interval_sec).filter(Boolean).map(Number);
    const avg = (arr) => arr.length ? arr.reduce((a, v) => a + v, 0) / arr.length : null;
    let analysis = sessionRows[0].analysis;
    let goToHospital = sessionRows[0].go_to_hospital;
    if (all.length >= 3) {
      const profile = await getProfile(req.user.id);
      const { system, user: userPrompt } = buildContractionPrompt({ user: profile || {}, contractions: all, totalCount: all.length, avgDurationSec: avg(durs), avgIntervalSec: avg(ints) });
      analysis = await jsonCall({ system, userPrompt, maxTokens: 600 });
      goToHospital = analysis.goToHospital || false;
    }
    const { rows: [updatedSession] } = await db.query(
      'UPDATE contraction_sessions SET total_contractions = $1, avg_duration_sec = $2, avg_interval_sec = $3, min_interval_sec = $4, max_duration_sec = $5, analysis = $6, go_to_hospital = $7, updated_at = now() WHERE id = $8 RETURNING *',
      [all.length, avg(durs), avg(ints), ints.length ? Math.min(...ints) : null, durs.length ? Math.max(...durs) : null, analysis ? JSON.stringify(analysis) : null, goToHospital, req.params.id]
    );
    return created(res, { event, session: updatedSession, analysis, goToHospital });
  } catch (err) { return next(err); }
});

router.put('/contractions/sessions/:id/close', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query('UPDATE contraction_sessions SET is_active = FALSE, ended_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (!rows.length) return notFound(res, 'Contraction session');
    return ok(res, { session: rows[0] });
  } catch (err) { return next(err); }
});

router.get('/contractions', authRequired, apiLimiter, validate(pagination, 'query'), async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const { rows } = await db.query('SELECT id, pregnancy_week, started_at, ended_at, total_contractions, avg_duration_sec, avg_interval_sec, min_interval_sec, go_to_hospital, is_active, analysis FROM contraction_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3', [req.user.id, limit, offset]);
    return ok(res, { sessions: rows, limit, offset });
  } catch (err) { return next(err); }
});

// SUMMARY
router.get('/summary', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const [s, m, w, k, c, streak] = await Promise.all([
      db.query('SELECT symptom_name, severity, logged_at FROM symptom_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1', [req.user.id]),
      db.query('SELECT mood, mood_score, risk_level, logged_at FROM mood_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1', [req.user.id]),
      db.query('SELECT weight_kg, pregnancy_week, logged_at FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1', [req.user.id]),
      db.query('SELECT kick_count, target_kicks, target_met, started_at FROM kick_counter_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1', [req.user.id]),
      db.query('SELECT id, total_contractions, avg_interval_sec, go_to_hospital FROM contraction_sessions WHERE user_id = $1 AND is_active = TRUE LIMIT 1', [req.user.id]),
      db.query("SELECT COUNT(DISTINCT DATE(logged_at)) AS streak_days FROM mood_logs WHERE user_id = $1 AND logged_at > now() - interval '30 days'", [req.user.id]),
    ]);
    return ok(res, {
      latestSymptom: s.rows[0] || null, latestMood: m.rows[0] || null,
      latestWeight: w.rows[0] || null, lastKickSession: k.rows[0] || null,
      activeContraction: c.rows[0] || null, moodStreakDays: parseInt(streak.rows[0] && streak.rows[0].streak_days || '0'),
    });
  } catch (err) { return next(err); }
});

module.exports = router;
