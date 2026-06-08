// routes/user.js
// GET  /api/user/profile
// PUT  /api/user/profile
// PUT  /api/user/preferences
// PUT  /api/user/language
// PUT  /api/user/push-token
// DELETE /api/user/account   (soft delete)

const express = require('express');
const bcrypt  = require('bcryptjs');
const { z }   = require('zod');

const db = require('../../db');
const { validate }        = require('../middleware/validate');
const { authRequired }    = require('../middleware/auth');
const { apiLimiter }      = require('../middleware/rateLimit');
const { ok, fail, notFound } = require('../middleware/respond');
const { getProfile, rowToProfile } = require('../../services/profiles');

const router = express.Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  displayName:           z.string().min(1).max(120).optional(),
  age:                   z.number().int().min(13).max(80).optional(),
  country:               z.string().max(3).optional(),
  language:              z.string().max(10).optional(),
  timezone:              z.string().max(64).optional(),
  unitSystem:            z.enum(['metric', 'imperial']).optional(),
  heightCm:              z.number().positive().max(300).optional(),
  prePregnancyWeightKg:  z.number().positive().max(500).optional(),
  bloodType:             z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  healthConditions:      z.array(z.string()).optional(),
  dietaryRestrictions:   z.array(z.string()).optional(),
  allergies:             z.array(z.string()).optional(),
  goals:                 z.array(z.string()).optional(),
});

const preferencesSchema = z.object({
  notifPref:       z.enum(['off', 'daily', 'weekly']).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  quietHoursEnd:   z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  partnerMode:     z.boolean().optional(),
  unitSystem:      z.enum(['metric', 'imperial']).optional(),
});

const languageSchema = z.object({
  language: z.string().min(2).max(10),
});

const pushTokenSchema = z.object({
  pushToken:    z.string().min(1).max(512),
  pushPlatform: z.enum(['ios', 'android', 'web']),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8).max(128),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /profile
router.get('/profile', authRequired, apiLimiter, async (req, res, next) => {
  try {
    const [userRows, profileRows] = await Promise.all([
      db.query(
        `SELECT id, email, display_name, account_type, email_verified, created_at
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [req.user.id]
      ),
      db.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [req.user.id]),
    ]);

    if (!userRows.rows.length) return notFound(res, 'User');

    const user    = userRows.rows[0];
    const profile = profileRows.rows[0] || null;

    return ok(res, {
      id:            user.id,
      email:         user.email,
      displayName:   user.display_name,
      accountType:   user.account_type,
      emailVerified: user.email_verified,
      createdAt:     user.created_at,
      profile:       profile ? rowToProfile(profile) : null,
      // Raw profile columns the app needs directly
      _raw: profile ? {
        age:                  profile.age,
        country:              profile.country,
        language:             profile.language,
        timezone:             profile.timezone,
        unitSystem:           profile.unit_system,
        heightCm:             profile.height_cm,
        prePregnancyWeightKg: profile.pre_pregnancy_weight_kg,
        bloodType:            profile.blood_type,
        healthConditions:     profile.health_conditions,
        dietaryRestrictions:  profile.dietary_restrictions,
        allergies:            profile.allergies,
        goals:                profile.goals,
        notifPref:            profile.notif_pref,
        quietHoursStart:      profile.quiet_hours_start,
        quietHoursEnd:        profile.quiet_hours_end,
        partnerMode:          profile.partner_mode,
        postpartumMode:       profile.postpartum_mode,
        lastActiveAt:         profile.last_active_at,
      } : null,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /profile
router.put(
  '/profile',
  authRequired,
  apiLimiter,
  validate(updateProfileSchema),
  async (req, res, next) => {
    try {
      const b = req.body;

      // Update users.display_name if provided
      if (b.displayName !== undefined) {
        await db.query(
          `UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`,
          [b.displayName, req.user.id]
        );
      }

      // Build dynamic SET clause for user_profiles
      const sets   = [];
      const params = [req.user.id];
      let   idx    = 2;

      const fields = {
        age:                    b.age,
        country:                b.country,
        language:               b.language,
        timezone:               b.timezone,
        unit_system:            b.unitSystem,
        height_cm:              b.heightCm,
        pre_pregnancy_weight_kg: b.prePregnancyWeightKg,
        blood_type:             b.bloodType,
        health_conditions:      b.healthConditions !== undefined ? JSON.stringify(b.healthConditions) : undefined,
        dietary_restrictions:   b.dietaryRestrictions !== undefined ? JSON.stringify(b.dietaryRestrictions) : undefined,
        allergies:              b.allergies !== undefined ? JSON.stringify(b.allergies) : undefined,
        goals:                  b.goals !== undefined ? JSON.stringify(b.goals) : undefined,
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
        `INSERT INTO user_profiles (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET ${sets.join(', ')}
         RETURNING *`,
        params
      );

      return ok(res, rowToProfile(rows[0]));
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /preferences
router.put(
  '/preferences',
  authRequired,
  apiLimiter,
  validate(preferencesSchema),
  async (req, res, next) => {
    try {
      const b = req.body;
      const sets   = [];
      const params = [req.user.id];
      let   idx    = 2;

      const fields = {
        notif_pref:        b.notifPref,
        quiet_hours_start: b.quietHoursStart,
        quiet_hours_end:   b.quietHoursEnd,
        partner_mode:      b.partnerMode,
        unit_system:       b.unitSystem,
      };

      for (const [col, val] of Object.entries(fields)) {
        if (val !== undefined) {
          sets.push(`${col} = $${idx}`);
          params.push(val);
          idx++;
        }
      }

      if (sets.length === 0) return fail(res, 'No preferences to update', 400);

      sets.push('updated_at = now()');

      const { rows } = await db.query(
        `INSERT INTO user_profiles (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET ${sets.join(', ')}
         RETURNING *`,
        params
      );

      return ok(res, {
        notifPref:       rows[0].notif_pref,
        quietHoursStart: rows[0].quiet_hours_start,
        quietHoursEnd:   rows[0].quiet_hours_end,
        partnerMode:     rows[0].partner_mode,
        unitSystem:      rows[0].unit_system,
      });
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /language  (separate endpoint because mobile changes language frequently)
router.put(
  '/language',
  authRequired,
  apiLimiter,
  validate(languageSchema),
  async (req, res, next) => {
    try {
      await db.query(
        `INSERT INTO user_profiles (user_id, language)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET language = $2, updated_at = now()`,
        [req.user.id, req.body.language]
      );
      return ok(res, { language: req.body.language });
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /push-token
router.put(
  '/push-token',
  authRequired,
  apiLimiter,
  validate(pushTokenSchema),
  async (req, res, next) => {
    try {
      await db.query(
        `INSERT INTO user_profiles (user_id, push_token, push_platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET push_token = $2, push_platform = $3, updated_at = now()`,
        [req.user.id, req.body.pushToken, req.body.pushPlatform]
      );
      return ok(res, { registered: true });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /change-password
router.post(
  '/change-password',
  authRequired,
  apiLimiter,
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (!rows.length) return notFound(res, 'User');

      const valid = await bcrypt.compare(req.body.currentPassword, rows[0].password_hash);
      if (!valid) return fail(res, 'Current password is incorrect', 400);

      const newHash = await bcrypt.hash(req.body.newPassword, 12);
      await db.query(
        `UPDATE users SET password_hash = $1, refresh_token_hash = NULL, updated_at = now()
         WHERE id = $2`,
        [newHash, req.user.id]
      );

      return ok(res, { message: 'Password changed. Please log in again.' });
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /account  (soft delete)
router.delete(
  '/account',
  authRequired,
  apiLimiter,
  validate(deleteAccountSchema),
  async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT password_hash FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (!rows.length) return notFound(res, 'User');

      const valid = await bcrypt.compare(req.body.password, rows[0].password_hash);
      if (!valid) return fail(res, 'Incorrect password', 400);

      await db.query(
        `UPDATE users
         SET deleted_at = now(), refresh_token_hash = NULL, updated_at = now()
         WHERE id = $1`,
        [req.user.id]
      );

      return ok(res, { message: 'Account deleted' });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
