// services/profiles.js
// Helpers to load and map user profiles between DB rows and the shape the
// prompt builders expect.

const db = require('../db');

/**
 * Maps a user_profiles DB row to the camelCase profile object used by prompts.
 */
function rowToProfile(row) {
  if (!row) return {};
  return {
    currentWeek: row.current_week,
    dueDate: row.due_date,
    trimester: row.trimester,
    isFirstPregnancy: row.is_first_pregnancy,
    isIvf: row.is_ivf,
    age: row.age,
    country: row.country,
    language: row.language,
    contentTrack: row.content_track,
    highRiskFlag: row.high_risk_flag,
    highRiskReason: row.high_risk_reason,
    goals: row.goals || [],
    healthConditions: row.health_conditions || [],
    dietaryRestrictions: row.dietary_restrictions || [],
    featurePriorities: row.feature_priorities || [],
    recentSymptoms: row.recent_symptoms || [],
    notifPref: row.notif_pref,
    partnerMode: row.partner_mode,
    postpartum: row.postpartum,
    babyAgeWeeks: row.baby_age_weeks,
    firstTipCategory: (row.feature_priorities && row.feature_priorities[0]) || 'general',
    onboardingMessage: row.onboarding_message,
  };
}

async function getProfile(userId) {
  const { rows } = await db.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
  return rows.length ? rowToProfile(rows[0]) : null;
}

async function getProfileRow(userId) {
  const { rows } = await db.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]);
  return rows[0] || null;
}

/**
 * upsertProfile(userId, profile) — insert or update the profile from a runOnboarding result.
 */
async function upsertProfile(userId, p) {
  const { rows } = await db.query(
    `INSERT INTO user_profiles (
       user_id, due_date, current_week, trimester, is_first_pregnancy, is_ivf, age,
       country, language, content_track, high_risk_flag, high_risk_reason,
       goals, health_conditions, dietary_restrictions, feature_priorities,
       notif_pref, onboarding_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (user_id) DO UPDATE SET
       due_date = EXCLUDED.due_date,
       current_week = EXCLUDED.current_week,
       trimester = EXCLUDED.trimester,
       is_first_pregnancy = EXCLUDED.is_first_pregnancy,
       is_ivf = EXCLUDED.is_ivf,
       age = EXCLUDED.age,
       country = EXCLUDED.country,
       language = EXCLUDED.language,
       content_track = EXCLUDED.content_track,
       high_risk_flag = EXCLUDED.high_risk_flag,
       high_risk_reason = EXCLUDED.high_risk_reason,
       goals = EXCLUDED.goals,
       health_conditions = EXCLUDED.health_conditions,
       dietary_restrictions = EXCLUDED.dietary_restrictions,
       feature_priorities = EXCLUDED.feature_priorities,
       notif_pref = EXCLUDED.notif_pref,
       onboarding_message = EXCLUDED.onboarding_message,
       updated_at = now()
     RETURNING *`,
    [
      userId,
      p.calculatedDueDate || null,
      p.currentWeek ?? null,
      p.trimester ?? null,
      p.isFirstPregnancy ?? true,
      p.isIvf ?? false,
      p.age ?? null,
      p.country || 'unknown',
      p.language || 'English',
      p.contentTrack || 'standard',
      p.highRiskFlag ?? false,
      p.highRiskReason || null,
      JSON.stringify(p.goals || []),
      JSON.stringify(p.healthConditions || []),
      JSON.stringify(p.dietaryRestrictions || []),
      JSON.stringify(p.featurePriorities || []),
      p.notifPref || 'daily',
      p.onboardingMessage || null,
    ]
  );
  return rowToProfile(rows[0]);
}

module.exports = { rowToProfile, getProfile, getProfileRow, upsertProfile };
