// api/routes/tracking.js
// POST /symptoms, POST /mood, POST /weight, POST /contractions, GET /tracking/history

const express = require('express');
const { z } = require('zod');

const db = require('../../db');
const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { aiLimiter, apiLimiter } = require('../middleware/rateLimit');
const { jsonCall } = require('../../lib/claude');
const { triageSymptom } = require('../../services/symptomTriage');
const { buildMentalHealthPrompt } = require('../../prompts/mentalHealthPrompt');
const { buildWeightGuidancePrompt } = require('../../prompts/weightGuidancePrompt');
const { buildContractionPrompt } = require('../../prompts/contractionPrompt');
const { getProfile } = require('../../services/profiles');

const router = express.Router();

// ── Symptoms ───────────────────────────────────────────────────────────────
const symptomSchema = z.object({
  symptomText: z.string().min(1).max(2000),
  severity: z.number().int().min(1).max(5).optional(),
  durationHours: z.number().min(0).optional(),
});

router.post('/symptoms', authRequired, aiLimiter, validate(symptomSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const result = await triageSymptom({
      userId: req.user.id,
      profile,
      symptomText: req.body.symptomText,
      severity: req.body.severity,
      durationHours: req.body.durationHours,
    });
    return res.json({ symptom: result, triage: result.triage_result });
  } catch (err) {
    return next(err);
  }
});

// ── Mood ───────────────────────────────────────────────────────────────────
const moodSchema = z.object({
  mood: z.string().min(1).max(200),
  note: z.string().max(2000).optional(),
});

router.post('/mood', authRequired, aiLimiter, validate(moodSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const { rows: recent } = await db.query(
      `SELECT mood, note, logged_at FROM moods WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 7`,
      [req.user.id]
    );
    const { system, user } = buildMentalHealthPrompt({
      user: profile,
      mood: req.body.mood,
      note: req.body.note,
      recentMoods: recent,
    });
    const analysis = await jsonCall({ system, userPrompt: user, maxTokens: 600 });

    const { rows } = await db.query(
      `INSERT INTO moods (user_id, mood, note, week, risk_level, analysis)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.user.id,
        req.body.mood,
        req.body.note || null,
        profile.currentWeek ?? null,
        analysis.riskLevel || null,
        JSON.stringify(analysis),
      ]
    );
    return res.json({ mood: rows[0], analysis });
  } catch (err) {
    return next(err);
  }
});

// ── Weight ─────────────────────────────────────────────────────────────────
const weightSchema = z.object({
  weightKg: z.number().positive(),
  prePregnancyWeightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
});

router.post('/weight', authRequired, aiLimiter, validate(weightSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const { system, user } = buildWeightGuidancePrompt({
      user: profile,
      weightKg: req.body.weightKg,
      prePregnancyWeightKg: req.body.prePregnancyWeightKg,
      heightCm: req.body.heightCm,
    });
    const guidance = await jsonCall({ system, userPrompt: user, maxTokens: 600 });

    const { rows } = await db.query(
      `INSERT INTO weights (user_id, weight_kg, week, guidance)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, req.body.weightKg, profile.currentWeek ?? null, JSON.stringify(guidance)]
    );
    return res.json({ weight: rows[0], guidance });
  } catch (err) {
    return next(err);
  }
});

// ── Contractions ───────────────────────────────────────────────────────────
const contractionSchema = z.object({
  contractions: z
    .array(
      z.object({
        startTime: z.string(),
        durationSec: z.number().int().positive(),
        intervalSec: z.number().int().positive().optional(),
      })
    )
    .min(1),
});

router.post('/contractions', authRequired, aiLimiter, validate(contractionSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const { system, user } = buildContractionPrompt({
      user: profile,
      contractions: req.body.contractions,
    });
    const analysis = await jsonCall({ system, userPrompt: user, maxTokens: 600 });

    // Persist each contraction under one session id.
    const sessionId = require('uuid').v4();
    for (const c of req.body.contractions) {
      await db.query(
        `INSERT INTO contractions (user_id, session_id, start_time, duration_sec, interval_sec, analysis)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.id, sessionId, c.startTime, c.durationSec, c.intervalSec ?? null, JSON.stringify(analysis)]
      );
    }
    return res.json({ sessionId, analysis });
  } catch (err) {
    return next(err);
  }
});

// ── History ────────────────────────────────────────────────────────────────
router.get('/history', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const [symptoms, moods, weights, contractions] = await Promise.all([
      db.query(`SELECT * FROM symptoms WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 50`, [req.user.id]),
      db.query(`SELECT * FROM moods WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 50`, [req.user.id]),
      db.query(`SELECT * FROM weights WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 50`, [req.user.id]),
      db.query(
        `SELECT session_id, MIN(start_time) AS started, COUNT(*) AS count
         FROM contractions WHERE user_id = $1 GROUP BY session_id ORDER BY started DESC LIMIT 20`,
        [req.user.id]
      ),
    ]);
    return res.json({
      symptoms: symptoms.rows,
      moods: moods.rows,
      weights: weights.rows,
      contractionSessions: contractions.rows,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
