// routes/ai.js
// All Claude API proxy endpoints — every AI feature the mobile app needs.
// Rate limited at 20 req/min per user via aiLimiter.
//
// POST /api/ai/chat                — main conversation (+ history management)
// GET  /api/ai/chat/conversations  — list conversations
// GET  /api/ai/chat/:conversationId — messages in a conversation
// DELETE /api/ai/chat/:conversationId
//
// POST /api/ai/triage              — symptom triage
// POST /api/ai/daily-tip           — personalized daily tip
// POST /api/ai/weight-guidance     — weight analysis
// POST /api/ai/mental-health       — mood analysis
// POST /api/ai/contraction-analysis — analyze a set of contraction events
// POST /api/ai/birth-plan          — generate birth plan
// POST /api/ai/baby-names          — suggest baby names
// POST /api/ai/baby-names/shortlist — save name to shortlist
// GET  /api/ai/baby-names/shortlist — get shortlist
// PUT  /api/ai/baby-names/shortlist/:id — update status
// POST /api/ai/onboarding          — run onboarding personalization (also in /onboarding)

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }             = require('../middleware/validate');
const { authRequired }         = require('../middleware/auth');
const { aiLimiter, apiLimiter } = require('../middleware/rateLimit');
const { ok, created, fail, notFound } = require('../middleware/respond');

const { sendMessage }          = require('../../services/session');
const { triageSymptom }        = require('../../services/symptomTriage');
const { getDailyTip }          = require('../../services/dailyTip');
const { getProfile }           = require('../../services/profiles');
const { jsonCall }             = require('../../lib/claude');

const { buildWeightGuidancePrompt }   = require('../../prompts/weightGuidancePrompt');
const { buildMentalHealthPrompt }     = require('../../prompts/mentalHealthPrompt');
const { buildContractionPrompt }      = require('../../prompts/contractionPrompt');
const { buildBirthPlanPrompt }        = require('../../prompts/birthPlanPrompt');
const { buildBabyNamePrompt }         = require('../../prompts/babyNamePrompt');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const chatSchema = z.object({
  message:        z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

const triageSchema = z.object({
  symptomName:   z.string().min(1).max(200),
  symptomRaw:    z.string().max(2000).optional().nullable(),
  severity:      z.number().int().min(1).max(5),
  durationHours: z.number().min(0).max(720).optional().nullable(),
  bodyLocation:  z.string().max(200).optional().nullable(),
  notes:         z.string().max(2000).optional().nullable(),
});

const weightSchema = z.object({
  weightKg: z.number().positive().max(500),
});

const moodSchema = z.object({
  mood:      z.string().min(1).max(100),
  moodScore: z.number().int().min(1).max(10).optional(),
  note:      z.string().max(2000).optional().nullable(),
});

const contractionSchema = z.object({
  contractions: z.array(z.object({
    startTime:   z.string(),
    durationSec: z.number().positive().optional(),
    intervalSec: z.number().positive().optional(),
  })).min(1),
});

const birthPlanSchema = z.object({
  preferences: z.record(z.any()).default({}),
});

const babyNameSchema = z.object({
  criteria: z.object({
    gender:     z.string().optional(),
    origin:     z.string().optional(),
    startsWith: z.string().optional(),
    style:      z.string().optional(),
    meaning:    z.string().optional(),
    avoid:      z.array(z.string()).optional(),
    count:      z.number().int().min(1).max(25).default(10),
  }).default({}),
});

const shortlistSchema = z.object({
  name:          z.string().min(1).max(100),
  genderFit:     z.enum(['boy','girl','neutral','any']).optional(),
  origin:        z.string().max(100).optional().nullable(),
  meaning:       z.string().max(500).optional().nullable(),
  pronunciation: z.string().max(200).optional().nullable(),
  syllables:     z.number().int().min(1).max(10).optional(),
  notes:         z.string().max(500).optional().nullable(),
});

const shortlistUpdateSchema = z.object({
  status:        z.enum(['saved','loved','vetoed','maybe']).optional(),
  partnerStatus: z.enum(['loved','vetoed','maybe','pending']).optional(),
  notes:         z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateConversation(userId, conversationId, mode) {
  if (conversationId) {
    const { rows } = await db.query(
      `SELECT * FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [conversationId, userId]
    );
    if (rows.length) return rows[0];
  }
  const { rows } = await db.query(
    `INSERT INTO conversations (user_id, mode) VALUES ($1, $2) RETURNING *`,
    [userId, mode]
  );
  return rows[0];
}

async function loadHistory(conversationId, limit = 40) {
  const { rows } = await db.query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC LIMIT $2`,
    [conversationId, limit]
  );
  return rows;
}

async function currentPregnancyId(userId) {
  const { rows } = await db.query(
    'SELECT id FROM pregnancies WHERE user_id = $1 AND is_current = TRUE LIMIT 1', [userId]
  );
  return rows[0]?.id || null;
}

// ---------------------------------------------------------------------------
// CHAT
// ---------------------------------------------------------------------------

// POST /chat
router.post('/chat', authRequired, aiLimiter, validate(chatSchema), async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const mode = profile.partnerMode ? 'partner'
               : profile.postpartum  ? 'postpartum'
               : 'standard';

    const conversation = await getOrCreateConversation(
      req.user.id, req.body.conversationId, mode
    );
    const history = await loadHistory(conversation.id);

    const { reply, emergency } = await sendMessage({
      userProfile: profile,
      message:     req.body.message,
      history,
    });

    // Persist both turns
    await db.query(
      `INSERT INTO messages (conversation_id, user_id, role, content)
       VALUES ($1,$2,'user',$3)`,
      [conversation.id, req.user.id, req.body.message]
    );
    await db.query(
      `INSERT INTO messages (conversation_id, user_id, role, content, is_emergency)
       VALUES ($1,$2,'assistant',$3,$4)`,
      [conversation.id, req.user.id, reply, emergency || false]
    );
    await db.query(
      'UPDATE conversations SET updated_at = now() WHERE id = $1',
      [conversation.id]
    );

    return ok(res, { reply, emergency: emergency || false, conversationId: conversation.id });
  } catch (err) {
    return next(err);
  }
});

// GET /chat/conversations
router.get('/chat/conversations', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.title, c.mode, c.updated_at,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM conversations c
       WHERE c.user_id = $1 AND c.deleted_at IS NULL
       ORDER BY c.updated_at DESC LIMIT 30`,
      [req.user.id]
    );
    return ok(res, { conversations: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /chat/:conversationId
router.get('/chat/:conversationId', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows: conv } = await db.query(
      `SELECT * FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.conversationId, req.user.id]
    );
    if (!conv.length) return notFound(res, 'Conversation');

    const limit  = Math.min(Number(req.query.limit) || 100, 200);
    const offset = Number(req.query.offset) || 0;

    const { rows: messages } = await db.query(
      `SELECT id, role, content, is_emergency, input_tokens, output_tokens, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [req.params.conversationId, limit, offset]
    );

    return ok(res, { conversation: conv[0], messages, limit, offset });
  } catch (err) {
    return next(err);
  }
});

// DELETE /chat/:conversationId
router.delete('/chat/:conversationId', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE conversations SET deleted_at = now() WHERE id = $1 AND user_id = $2`,
      [req.params.conversationId, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Conversation');
    return ok(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// SYMPTOM TRIAGE
// ---------------------------------------------------------------------------

router.post('/triage', authRequired, aiLimiter, validate(triageSchema), async (req, res, next) => {
  try {
    const [profile, pregnancyId] = await Promise.all([
      getProfile(req.user.id),
      currentPregnancyId(req.user.id),
    ]);

    const result = await triageSymptom({
      userId:       req.user.id,
      profile:      profile || {},
      pregnancyId,
      symptomName:  req.body.symptomName,
      symptomRaw:   req.body.symptomRaw,
      severity:     req.body.severity,
      durationHours: req.body.durationHours,
      bodyLocation: req.body.bodyLocation,
      notes:        req.body.notes,
    });

    return ok(res, { triage: result.triage_result, symptomId: result.id });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// DAILY TIP
// ---------------------------------------------------------------------------

router.post('/daily-tip', authRequired, aiLimiter, async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const tip = await getDailyTip(profile, req.user.id);
    return ok(res, { tip });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// WEIGHT GUIDANCE
// ---------------------------------------------------------------------------

router.post('/weight-guidance', authRequired, aiLimiter, validate(weightSchema), async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const { system, user: userPrompt } = buildWeightGuidancePrompt({
      user: profile, weightKg: req.body.weightKg,
    });
    const guidance = await jsonCall({ system, userPrompt, maxTokens: 600 });
    return ok(res, { guidance });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// MENTAL HEALTH / MOOD ANALYSIS
// ---------------------------------------------------------------------------

router.post('/mental-health', authRequired, aiLimiter, validate(moodSchema), async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const { rows: recentRows } = await db.query(
      `SELECT mood, mood_score, note, logged_at FROM mood_logs
       WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 7`,
      [req.user.id]
    );
    const { system, user: userPrompt } = buildMentalHealthPrompt({
      user:        profile,
      mood:        req.body.mood,
      moodScore:   req.body.moodScore,
      note:        req.body.note,
      recentMoods: recentRows,
      isPostpartum: profile.postpartum || false,
    });
    const analysis = await jsonCall({ system, userPrompt, maxTokens: 600 });
    return ok(res, { analysis });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// CONTRACTION ANALYSIS
// ---------------------------------------------------------------------------

router.post('/contraction-analysis', authRequired, aiLimiter, validate(contractionSchema), async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const { system, user: userPrompt } = buildContractionPrompt({
      user:        profile,
      contractions: req.body.contractions,
      totalCount:  req.body.contractions.length,
    });
    const analysis = await jsonCall({ system, userPrompt, maxTokens: 600 });
    return ok(res, { analysis });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// BIRTH PLAN GENERATION
// ---------------------------------------------------------------------------

router.post('/birth-plan', authRequired, aiLimiter, validate(birthPlanSchema), async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const { system, user: userPrompt } = buildBirthPlanPrompt({
      user: profile, preferences: req.body.preferences,
    });
    const plan = await jsonCall({ system, userPrompt, maxTokens: 1800 });
    return ok(res, { plan });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// BABY NAMES
// ---------------------------------------------------------------------------

// POST /baby-names  — generate suggestions
router.post('/baby-names', authRequired, aiLimiter, validate(babyNameSchema), async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id) || {};
    const { system, user: userPrompt } = buildBabyNamePrompt({
      user: profile, criteria: req.body.criteria,
    });
    const result = await jsonCall({ system, userPrompt, maxTokens: 1200 });
    return ok(res, { suggestions: result.suggestions || [] });
  } catch (err) {
    return next(err);
  }
});

// POST /baby-names/shortlist  — save a name
router.post('/baby-names/shortlist', authRequired, apiLimiter, validate(shortlistSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const pregnancyId = await currentPregnancyId(req.user.id);

    const { rows: [entry] } = await db.query(
      `INSERT INTO baby_names_shortlist
         (user_id, pregnancy_id, name, gender_fit, origin, meaning,
          pronunciation, syllables, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        req.user.id, pregnancyId, b.name, b.genderFit || null,
        b.origin || null, b.meaning || null, b.pronunciation || null,
        b.syllables || null, b.notes || null,
      ]
    );

    return created(res, { name: entry });
  } catch (err) {
    return next(err);
  }
});

// GET /baby-names/shortlist
router.get('/baby-names/shortlist', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, gender_fit, origin, meaning, pronunciation,
              syllables, status, partner_status, notes, created_at
       FROM baby_names_shortlist
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY CASE status
         WHEN 'loved'  THEN 1
         WHEN 'saved'  THEN 2
         WHEN 'maybe'  THEN 3
         WHEN 'vetoed' THEN 4
         ELSE 5 END, name`,
      [req.user.id]
    );
    return ok(res, { names: rows });
  } catch (err) {
    return next(err);
  }
});

// PUT /baby-names/shortlist/:id
router.put('/baby-names/shortlist/:id', authRequired, apiLimiter, validate(shortlistUpdateSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const sets   = [];
    const params = [req.params.id, req.user.id];
    let   idx    = 3;

    const fields = {
      status:         b.status,
      partner_status: b.partnerStatus,
      notes:          b.notes,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${col} = $${idx}`); params.push(val); idx++; }
    }

    if (!sets.length) return fail(res, 'No fields to update', 400);
    sets.push('updated_at = now()');

    const { rows } = await db.query(
      `UPDATE baby_names_shortlist SET ${sets.join(', ')}
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING *`,
      params
    );

    if (!rows.length) return notFound(res, 'Name');
    return ok(res, { name: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /baby-names/shortlist/:id
router.delete('/baby-names/shortlist/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE baby_names_shortlist SET deleted_at = now()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Name');
    return ok(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
