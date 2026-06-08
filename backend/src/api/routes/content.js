// api/routes/content.js
// GET /week/:week, GET /daily-tip, GET /emergency-resources

const express = require('express');

const db = require('../../db');
const { authRequired } = require('../middleware/auth');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimit');
const { getWeekContent } = require('../../services/weeklyContent');
const { getDailyTip } = require('../../services/dailyTip');
const { getProfile } = require('../../services/profiles');

const { ok } = require('../middleware/respond');
const router = express.Router();

router.get('/week/:week', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const week = Number(req.params.week);
    if (!Number.isInteger(week) || week < 0 || week > 45) {
      return res.status(400).json({ success: false, error: 'Invalid week' });
    }
    const profile = (await getProfile(req.user.id)) || {};
    const content = await getWeekContent({
      week,
      track: req.query.track || profile.contentTrack || 'standard',
      language: req.query.language || profile.language || 'English',
      phase: req.query.phase || 'pregnancy',
    });
    return res.json({ success: true, data: { week, content } });
  } catch (err) {
    return next(err);
  }
});

router.get('/daily-tip', authRequired, aiLimiter, async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const tip = await getDailyTip(profile, req.user.id);
    return res.json({ success: true, data: { tip } });
  } catch (err) {
    return next(err);
  }
});

router.get('/emergency-resources', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const country = (req.query.country || profile.country || 'unknown').toUpperCase();
    const language = req.query.language || profile.language || 'English';

    let { rows } = await db.query(
      `SELECT * FROM emergency_resources WHERE country = $1 AND language = $2 LIMIT 1`,
      [country, language]
    );
    if (!rows.length) {
      ({ rows } = await db.query(
        `SELECT * FROM emergency_resources WHERE country = 'unknown' LIMIT 1`
      ));
    }
    return res.json({ success: true, data: { resources: rows[0] || null } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
