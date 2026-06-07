// api/routes/postpartum.js
// POST /birth-logged, GET /newborn-week/:week

const express = require('express');
const { z } = require('zod');

const db = require('../../db');
const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { getWeekContent } = require('../../services/weeklyContent');
const { getProfile } = require('../../services/profiles');

const router = express.Router();

const birthLoggedSchema = z.object({
  birthDate: z.string().min(1),
});

// Swap the user into postpartum/newborn mode when birth is logged.
router.post('/birth-logged', authRequired, apiLimiter, validate(birthLoggedSchema), async (req, res, next) => {
  try {
    const birth = new Date(req.body.birthDate);
    const weeks = Math.max(0, Math.floor((Date.now() - birth.getTime()) / (7 * 24 * 3600 * 1000)));

    const { rows } = await db.query(
      `UPDATE user_profiles
       SET postpartum = TRUE, baby_age_weeks = $2, birth_logged_at = $3, updated_at = now()
       WHERE user_id = $1
       RETURNING *`,
      [req.user.id, weeks, birth.toISOString()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    return res.json({ postpartum: true, babyAgeWeeks: weeks });
  } catch (err) {
    return next(err);
  }
});

router.get('/newborn-week/:week', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const week = Number(req.params.week);
    if (!Number.isInteger(week) || week < 0 || week > 12) {
      return res.status(400).json({ error: 'Newborn week must be 0-12' });
    }
    const profile = (await getProfile(req.user.id)) || {};
    const content = await getWeekContent({
      week,
      track: 'standard',
      language: profile.language || 'English',
      phase: 'newborn',
    });
    return res.json({ week, content });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
