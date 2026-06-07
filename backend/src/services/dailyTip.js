// services/dailyTip.js
// Generates (and caches per day) a personalised daily tip for a user.

const { jsonCall } = require('../lib/claude');
const { buildDailyTipPrompt } = require('../prompts/dailyTipPrompt');

// Simple in-memory daily cache: key = `${userId}:${YYYY-MM-DD}`
const _cache = new Map();

function todayKey(userId) {
  const day = new Date().toISOString().slice(0, 10);
  return `${userId}:${day}`;
}

/**
 * getDailyTip(profile, userId) → tip object
 * Caches one tip per user per day to avoid repeat API calls.
 */
async function getDailyTip(profile, userId = 'anon') {
  const key = todayKey(userId);
  if (_cache.has(key)) return _cache.get(key);

  const { system, user } = buildDailyTipPrompt(profile);
  const tip = await jsonCall({ system, userPrompt: user, maxTokens: 600 });
  _cache.set(key, tip);
  return tip;
}

module.exports = { getDailyTip };
