// api/routes/features.js
// POST /birth-plan, GET /hospital-bag, POST /baby-names, GET /development/:week

const express = require('express');
const { z } = require('zod');

const db = require('../../db');
const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { aiLimiter, apiLimiter } = require('../middleware/rateLimit');
const { jsonCall } = require('../../lib/claude');
const { buildBirthPlanPrompt } = require('../../prompts/birthPlanPrompt');
const { buildBabyNamePrompt } = require('../../prompts/babyNamePrompt');
const { getWeekContent } = require('../../services/weeklyContent');
const { getProfile } = require('../../services/profiles');

const { ok } = require('../middleware/respond');
const router = express.Router();

// ── Birth plan ─────────────────────────────────────────────────────────────
const birthPlanSchema = z.object({
  preferences: z.record(z.any()).default({}),
});

router.post('/birth-plan', authRequired, aiLimiter, validate(birthPlanSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const { system, user } = buildBirthPlanPrompt({ user: profile, preferences: req.body.preferences });
    const plan = await jsonCall({ system, userPrompt: user, maxTokens: 1500 });
    return res.json({ success: true, data: { plan } });
  } catch (err) {
    return next(err);
  }
});

// ── Hospital bag ───────────────────────────────────────────────────────────
router.get('/hospital-bag', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const system = `You are Bloom's hospital-bag checklist generator. Tailor the list to
the user's country and circumstances. Return ONLY valid JSON — no preamble.`;
    const user = `Generate a hospital bag checklist.
Country: ${profile.country || 'unknown'}
Language: ${profile.language || 'English'}
First pregnancy: ${profile.isFirstPregnancy ?? true}
Content track: ${profile.contentTrack || 'standard'}

Return exactly:
{
  "categories": [
    { "name": "category (e.g. For You, For Baby, Documents, Partner)",
      "items": [ { "item": "name", "essential": true, "note": "optional note or null" } ] }
  ]
}`;
    const checklist = await jsonCall({ system, userPrompt: user, maxTokens: 1200 });
    return res.json({ success: true, data: { checklist } });
  } catch (err) {
    return next(err);
  }
});

// ── Baby names ─────────────────────────────────────────────────────────────
const babyNameSchema = z.object({
  criteria: z
    .object({
      gender: z.string().optional(),
      origin: z.string().optional(),
      startsWith: z.string().optional(),
      style: z.string().optional(),
      meaning: z.string().optional(),
      avoid: z.array(z.string()).optional(),
      count: z.number().int().min(1).max(25).optional(),
    })
    .default({}),
});

router.post('/baby-names', authRequired, aiLimiter, validate(babyNameSchema), async (req, res, next) => {
  try {
    const profile = (await getProfile(req.user.id)) || {};
    const { system, user } = buildBabyNamePrompt({ user: profile, criteria: req.body.criteria });
    const result = await jsonCall({ system, userPrompt: user, maxTokens: 1200 });

    // Persist suggestions (not favorited) for later browsing.
    for (const s of result.suggestions || []) {
      await db.query(
        `INSERT INTO baby_names (user_id, name, gender, origin, meaning, pronunciation)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.id, s.name, s.gender || null, s.origin || null, s.meaning || null, s.pronunciation || null]
      );
    }
    return res.json({ success: true, data: { suggestions: result.suggestions || [] } });
  } catch (err) {
    return next(err);
  }
});

// ── Development week (cached) ──────────────────────────────────────────────
router.get('/development/:week', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const week = Number(req.params.week);
    if (!Number.isInteger(week)) return res.status(400).json({ success: false, error: 'Invalid week' });
    const profile = (await getProfile(req.user.id)) || {};
    const content = await getWeekContent({
      week,
      track: profile.contentTrack || 'standard',
      language: profile.language || 'English',
      phase: 'pregnancy',
    });
    return res.json({ success: true, data: { week, development: content } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
