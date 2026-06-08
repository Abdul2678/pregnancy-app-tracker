/**
 * services/ai/dailyTip.js
 * Generates a personalised daily pregnancy tip.
 * Rotates categories, never repeats yesterday's category, persists to DB.
 *
 * Usage:
 *   const { getDailyTip } = require('./dailyTip');
 *   const tip = await getDailyTip({ userId, profile, pregnancy });
 *   // tip.title, tip.body, tip.category, tip.weekRelevance
 */

'use strict';

const db = require('../../db');
const { jsonCall }            = require('../claude');
const { buildDailyTipPrompt } = require('../../prompts/dailyTipPrompt');

// ---------------------------------------------------------------------------
// Category rotation
// ---------------------------------------------------------------------------

const TIP_CATEGORIES = [
  'nutrition',
  'movement',
  'wellbeing',
  'preparation',
  'symptom',
  'partner',
];

/**
 * Picks the next category, ensuring it differs from yesterday's.
 * @param {string|null} lastCategory
 * @param {number}      currentWeek
 * @returns {string}
 */
function pickCategory(lastCategory, currentWeek) {
  // Weight categories by trimester relevance
  const weights =
    currentWeek <= 13
      ? { nutrition: 3, wellbeing: 2, symptom: 2, movement: 1, preparation: 1, partner: 1 }
      : currentWeek <= 26
        ? { nutrition: 2, movement: 2, wellbeing: 2, preparation: 2, symptom: 1, partner: 1 }
        : { preparation: 3, movement: 2, wellbeing: 2, nutrition: 1, symptom: 1, partner: 1 };

  // Expand weights into a pool, exclude yesterday's category
  const pool = [];
  for (const [cat, weight] of Object.entries(weights)) {
    if (cat !== lastCategory) {
      for (let i = 0; i < weight; i++) pool.push(cat);
    }
  }

  return pool[Math.floor(Math.random() * pool.length)] || TIP_CATEGORIES[0];
}

// ---------------------------------------------------------------------------
// In-process cache (falls back if DB is unavailable)
// ---------------------------------------------------------------------------

// Map<userId, { date: string, tip: object }>
const _cache = new Map();

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {object} DailyTipResult
 * @property {string} title
 * @property {string} body
 * @property {string} category
 * @property {string} weekRelevance
 * @property {string} date          YYYY-MM-DD
 * @property {boolean} cached       true if served from in-process cache
 */

/**
 * Returns today's tip for the user.
 * Generates a new one (and caches it) if not yet produced today.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} [opts.profile]     User profile row
 * @param {object} [opts.pregnancy]   Pregnancy row
 * @returns {Promise<DailyTipResult>}
 */
async function getDailyTip({ userId, profile = {}, pregnancy = {} }) {
  const today = new Date().toISOString().split('T')[0];

  // ── In-process cache hit ─────────────────────────────────────────────────
  const cached = _cache.get(userId);
  if (cached && cached.date === today) {
    return { ...cached.tip, date: today, cached: true };
  }

  // ── DB cache hit ─────────────────────────────────────────────────────────
  let lastCategory = null;
  try {
    const { rows } = await db.query(
      `SELECT data, sent_at
       FROM notifications
       WHERE user_id = $1 AND type = 'daily_tip'
       ORDER BY sent_at DESC LIMIT 2`,
      [userId]
    );
    const todayRow = rows.find((r) => {
      const d = r.data || {};
      return (typeof d === 'string' ? JSON.parse(d) : d).date === today;
    });
    if (todayRow) {
      const d = typeof todayRow.data === 'string' ? JSON.parse(todayRow.data) : todayRow.data;
      const tip = { title: d.title, body: d.body, category: d.category, weekRelevance: d.weekRelevance };
      _cache.set(userId, { date: today, tip });
      return { ...tip, date: today, cached: true };
    }
    if (rows[0]) {
      const d = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      lastCategory = d.category || null;
    }
  } catch (err) {
    console.warn('[dailyTip] DB read failed:', err.message);
  }

  // ── Generate new tip ─────────────────────────────────────────────────────
  const week     = pregnancy.current_week || profile.currentWeek || 0;
  const category = pickCategory(lastCategory, week);
  const language = profile.language || 'en';

  let tip;
  try {
    const { system, user: userPrompt } = buildDailyTipPrompt({
      user:     { ...profile, currentWeek: week },
      category,
      language,
    });
    const ai = await jsonCall({ system, userPrompt, maxTokens: 400 });
    tip = {
      title:         ai.title         || 'Today\'s Tip',
      body:          ai.body          || '',
      category:      ai.category      || category,
      weekRelevance: ai.weekRelevance || `Week ${week}`,
    };
  } catch (err) {
    tip = {
      title:         'Daily Wellness Reminder',
      body:          'Remember to stay hydrated and rest when you need to.',
      category,
      weekRelevance: `Week ${week}`,
    };
    console.error('[dailyTip] AI generation failed:', err.message);
  }

  // ── Persist to DB ────────────────────────────────────────────────────────
  try {
    await db.query(
      `INSERT INTO notifications
         (user_id, type, title, body, data, status, scheduled_for, sent_at)
       VALUES ($1,'daily_tip',$2,$3,$4,'sent', now(), now())`,
      [userId, tip.title, tip.body, JSON.stringify({ ...tip, date: today })]
    );
  } catch (err) {
    console.warn('[dailyTip] DB persist failed:', err.message);
  }

  _cache.set(userId, { date: today, tip });
  return { ...tip, date: today, cached: false };
}

module.exports = { getDailyTip, pickCategory };
