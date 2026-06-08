/**
 * services/ai/weekContent.js
 * Fetches or generates week-by-week pregnancy content.
 * Reads from pregnancy_weeks_cache; generates and caches on miss.
 *
 * Usage:
 *   const { getWeekContent, generateAllWeeks } = require('./weekContent');
 *
 *   // Single week fetch (with auto-generate on miss)
 *   const content = await getWeekContent({ week: 20, track: 'standard', language: 'en' });
 *
 *   // Bulk generation script (run once or as a job)
 *   await generateAllWeeks({ track: 'standard', language: 'en', phase: 'pregnancy' });
 */

'use strict';

const db = require('../../db');
const { generateWeekContent } = require('../contentGenerator');

// ---------------------------------------------------------------------------
// In-process LRU-style cache (max 200 entries)
// ---------------------------------------------------------------------------

const _cache = new Map();
const CACHE_MAX = 200;

function cacheKey(week, track, language, phase) {
  return `${week}:${track}:${language}:${phase}`;
}

function cacheSet(key, value) {
  if (_cache.size >= CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, value);
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * Returns week content for the given parameters.
 * Checks in-process cache → DB → generates via AI on miss.
 *
 * @param {object} opts
 * @param {number} opts.week        1–42 (pregnancy) or 0–52 (postpartum newborn)
 * @param {string} [opts.track]     'standard'|'high_risk'|'multiples'|'ivf'
 * @param {string} [opts.language]  BCP-47, default 'en'
 * @param {string} [opts.phase]     'pregnancy'|'postpartum'
 * @returns {Promise<object|null>}
 */
async function getWeekContent({
  week,
  track    = 'standard',
  language = 'en',
  phase    = 'pregnancy',
}) {
  if (!week && week !== 0) return null;

  const key = cacheKey(week, track, language, phase);

  // ── In-process cache ─────────────────────────────────────────────────────
  if (_cache.has(key)) return _cache.get(key);

  // ── DB cache ─────────────────────────────────────────────────────────────
  try {
    const { rows } = await db.query(
      `SELECT content FROM pregnancy_weeks_cache
       WHERE week_number = $1
         AND content_track = $2
         AND language      = $3
         AND phase         = $4
       LIMIT 1`,
      [week, track, language, phase]
    );

    if (rows[0]?.content) {
      const content = typeof rows[0].content === 'string'
        ? JSON.parse(rows[0].content)
        : rows[0].content;
      cacheSet(key, content);
      return content;
    }
  } catch (err) {
    console.warn('[weekContent] DB read failed:', err.message);
  }

  // ── AI generation ────────────────────────────────────────────────────────
  try {
    const content = await generateWeekContent({ week, track, language, phase });
    if (content) cacheSet(key, content);
    return content || null;
  } catch (err) {
    console.error('[weekContent] Generation failed for week', week, ':', err.message);
    return null;
  }
}

/**
 * Bulk-generates content for all weeks and upserts into DB.
 * Safe to run multiple times (uses ON CONFLICT DO UPDATE).
 *
 * @param {object} opts
 * @param {string} [opts.track]    Default 'standard'
 * @param {string} [opts.language] Default 'en'
 * @param {string} [opts.phase]    Default 'pregnancy'
 * @param {number} [opts.fromWeek] Default 1
 * @param {number} [opts.toWeek]   Default 40
 * @param {number} [opts.delayMs]  Pause between calls (ms), default 500
 * @returns {Promise<{ generated: number, failed: number }>}
 */
async function generateAllWeeks({
  track    = 'standard',
  language = 'en',
  phase    = 'pregnancy',
  fromWeek = 1,
  toWeek   = 40,
  delayMs  = 500,
} = {}) {
  let generated = 0;
  let failed    = 0;

  for (let week = fromWeek; week <= toWeek; week++) {
    try {
      const content = await generateWeekContent({ week, track, language, phase });
      if (content) {
        await db.query(
          `INSERT INTO pregnancy_weeks_cache
             (week_number, content_track, language, phase, content)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (week_number, content_track, language, phase)
           DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
          [week, track, language, phase, JSON.stringify(content)]
        );
        const key = cacheKey(week, track, language, phase);
        cacheSet(key, content);
        generated++;
      }
    } catch (err) {
      console.error(`[weekContent] Failed week ${week}:`, err.message);
      failed++;
    }

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  console.log(`[weekContent] Bulk generation complete: ${generated} ok, ${failed} failed`);
  return { generated, failed };
}

/**
 * Clears the in-process cache (useful in tests).
 */
function clearCache() {
  _cache.clear();
}

module.exports = { getWeekContent, generateAllWeeks, clearCache };
