// routes/birthplan.js
// POST /api/birthplan                — save preferences + trigger AI generation
// GET  /api/birthplan                — get latest plan
// GET  /api/birthplan/:id            — get specific version
// PUT  /api/birthplan/:id/finalize   — mark as final
// POST /api/birthplan/:id/regenerate — re-run AI with same preferences
//
// GET  /api/birthplan/hospital-bag          — get user's bag checklist
// PUT  /api/birthplan/hospital-bag/:itemId  — check/uncheck item
// POST /api/birthplan/hospital-bag          — add custom item
// DELETE /api/birthplan/hospital-bag/:itemId

const express = require('express');
const { z }   = require('zod');

const db = require('../../db');
const { validate }             = require('../middleware/validate');
const { authRequired }         = require('../middleware/auth');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimit');
const { ok, created, fail, notFound } = require('../middleware/respond');
const { buildBirthPlanPrompt } = require('../../prompts/birthPlanPrompt');
const { jsonCall }             = require('../../lib/claude');
const { getProfile }           = require('../../services/profiles');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const preferencesSchema = z.object({
  title:       z.string().min(1).max(200).default('My Birth Plan'),
  preferences: z.object({
    // Labour preferences
    painManagement:      z.array(z.string()).optional(),
    birthEnvironment:    z.string().optional(),
    supportPeople:       z.array(z.string()).optional(),
    mobilityDuringLabour: z.string().optional(),
    waterBirth:          z.boolean().optional(),

    // Delivery preferences
    delayedCordClamping: z.boolean().optional(),
    placentaPreferences: z.string().optional(),
    deliveryPosition:    z.string().optional(),
    episiotomy:          z.string().optional(),

    // After birth
    skinToSkin:          z.boolean().optional(),
    feedingIntention:    z.enum(['breastfeed','formula','mixed','unsure']).optional(),
    vit_k:               z.string().optional(),
    eyeDrops:            z.boolean().optional(),
    delayedBathing:      z.boolean().optional(),

    // C-section specifics
    cSectionPreferences: z.record(z.any()).optional(),

    // NICU / complications
    nicuPreferences:     z.record(z.any()).optional(),

    // Additional notes
    additionalWishes:    z.string().max(2000).optional(),
  }).default({}),
});

const bagItemSchema = z.object({
  itemName:   z.string().min(1).max(200),
  category:   z.enum(['documents','labour','postpartum_parent','baby','comfort','partner','other'])
                .default('other'),
  isEssential: z.boolean().default(false),
  notes:      z.string().max(500).optional().nullable(),
});

const toggleBagSchema = z.object({
  isChecked: z.boolean(),
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

async function generatePlan(profile, preferences) {
  const { system, user: userPrompt } = buildBirthPlanPrompt({ user: profile, preferences });
  return jsonCall({ system, userPrompt, maxTokens: 1800 });
}

// ---------------------------------------------------------------------------
// BIRTH PLAN
// ---------------------------------------------------------------------------

// POST /  — create or update plan
router.post('/', authRequired, aiLimiter, validate(preferencesSchema), async (req, res, next) => {
  try {
    const [profile, pregnancyId] = await Promise.all([
      getProfile(req.user.id),
      currentPregnancyId(req.user.id),
    ]);

    const aiResult = await generatePlan(profile || {}, req.body.preferences);

    // Get current version number
    const { rows: existing } = await db.query(
      `SELECT COALESCE(MAX(version), 0) AS max_v FROM birth_plans
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [req.user.id]
    );
    const nextVersion = (existing[0]?.max_v || 0) + 1;

    const { rows: [plan] } = await db.query(
      `INSERT INTO birth_plans
         (user_id, pregnancy_id, title, preferences, generated_plan, plan_sections, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        req.user.id, pregnancyId, req.body.title,
        JSON.stringify(req.body.preferences),
        aiResult.generatedPlan || aiResult.plan || null,
        JSON.stringify(aiResult.sections || []),
        nextVersion,
      ]
    );

    return created(res, { plan });
  } catch (err) {
    return next(err);
  }
});

// GET /  — get latest plan
router.get('/', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM birth_plans
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY version DESC LIMIT 1`,
      [req.user.id]
    );
    return ok(res, { plan: rows[0] || null });
  } catch (err) {
    return next(err);
  }
});

// GET /versions  — list all versions
router.get('/versions', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, title, version, is_final, shared_with_provider, created_at
       FROM birth_plans WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY version DESC`,
      [req.user.id]
    );
    return ok(res, { versions: rows });
  } catch (err) {
    return next(err);
  }
});

// GET /:id
router.get('/:id', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM birth_plans WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return notFound(res, 'Birth plan');
    return ok(res, { plan: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PUT /:id/finalize
router.put('/:id/finalize', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE birth_plans SET is_final = TRUE, updated_at = now()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return notFound(res, 'Birth plan');
    return ok(res, { plan: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// POST /:id/regenerate  — re-run AI with stored preferences
router.post('/:id/regenerate', authRequired, aiLimiter, async (req, res, next) => {
  try {
    const { rows: existing } = await db.query(
      'SELECT * FROM birth_plans WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!existing.length) return notFound(res, 'Birth plan');

    const plan = existing[0];
    const profile = await getProfile(req.user.id);
    const aiResult = await generatePlan(profile || {}, plan.preferences || {});

    const { rows: [updated] } = await db.query(
      `UPDATE birth_plans
       SET generated_plan = $1, plan_sections = $2, version = version + 1,
           is_final = FALSE, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [
        aiResult.generatedPlan || aiResult.plan || null,
        JSON.stringify(aiResult.sections || []),
        req.params.id,
      ]
    );

    return ok(res, { plan: updated });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// HOSPITAL BAG
// ---------------------------------------------------------------------------

// GET /hospital-bag  — get user's bag (pre-seeded items + custom)
router.get('/hospital-bag', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, item_name, category, is_checked, is_essential, notes, sort_order, template_key
       FROM hospital_bag_items
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY category, sort_order, item_name`,
      [req.user.id]
    );

    // Group by category
    const grouped = {};
    for (const item of rows) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const totalItems   = rows.length;
    const checkedItems = rows.filter((r) => r.is_checked).length;

    return ok(res, {
      items: rows,
      grouped,
      progress: { total: totalItems, checked: checkedItems, percent: totalItems ? Math.round((checkedItems / totalItems) * 100) : 0 },
    });
  } catch (err) {
    return next(err);
  }
});

// POST /hospital-bag  — add custom item
router.post('/hospital-bag', authRequired, apiLimiter, validate(bagItemSchema), async (req, res, next) => {
  try {
    const pregnancyId = await currentPregnancyId(req.user.id);

    const { rows: [item] } = await db.query(
      `INSERT INTO hospital_bag_items
         (user_id, pregnancy_id, item_name, category, is_essential, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        req.user.id, pregnancyId, req.body.itemName, req.body.category,
        req.body.isEssential, req.body.notes || null,
      ]
    );

    return created(res, { item });
  } catch (err) {
    return next(err);
  }
});

// PUT /hospital-bag/:itemId  — check/uncheck
router.put('/hospital-bag/:itemId', authRequired, apiLimiter, validate(toggleBagSchema), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE hospital_bag_items
       SET is_checked = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL RETURNING *`,
      [req.body.isChecked, req.params.itemId, req.user.id]
    );
    if (!rows.length) return notFound(res, 'Bag item');
    return ok(res, { item: rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /hospital-bag/:itemId
router.delete('/hospital-bag/:itemId', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `UPDATE hospital_bag_items SET deleted_at = now()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [req.params.itemId, req.user.id]
    );
    if (!rowCount) return notFound(res, 'Bag item');
    return ok(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
