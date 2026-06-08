/**
 * services/ai/mentalHealth.js
 * Mental-health check-in with PPD/PPA screening (Edinburgh logic) and
 * crisis detection with local resource routing.
 *
 * Usage:
 *   const { assessMentalHealth, scoreEPDS } = require('./mentalHealth');
 *
 *   // Mood check-in assessment
 *   const result = await assessMentalHealth({
 *     userId, mood: 'anxious', note: 'can\'t sleep, very worried',
 *     recentMoods: [{ mood: 'anxious', mood_score: 3 }], profile
 *   });
 *
 *   // EPDS scoring
 *   const epds = scoreEPDS([3, 2, 1, 0, 1, 0, 1, 2, 3, 1]);
 *   // epds.total, epds.riskLevel, epds.flag
 */

'use strict';

const db = require('../../db');
const { jsonCall }                  = require('../claude');
const { buildMentalHealthPrompt }   = require('../../prompts/mentalHealthPrompt');

// ---------------------------------------------------------------------------
// Crisis keyword intercept
// ---------------------------------------------------------------------------

const CRISIS_PATTERNS = [
  /\bsuicid/i,
  /\bself.?harm/i,
  /\bhurt\s+(myself|me)\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live)/i,
  /\bend\s+(my|it\s+all)/i,
  /\bwish\s+I\s+(was|were)\s+dead/i,
  /\bno\s+reason\s+to\s+live/i,
  /\babuse/i,
  /\bdomestic\s+violence/i,
  /\bhe\s+(hit|hurt|beat)\s+me/i,
];

const CRISIS_RESPONSE = {
  riskLevel:          'crisis',
  reflection:         'I\'m really glad you\'re sharing this with me. What you\'re feeling matters.',
  ppdScreenSuggested: true,
  patternNote:        null,
  suggestions:        [
    'Please reach out to a crisis helpline right now — you don\'t have to face this alone.',
    'If you are in immediate danger, call emergency services (911 / 999 / 112).',
  ],
  resourcePrompt:     'Crisis support is available 24/7. Would you like me to find the helpline for your country?',
  crisis:             true,
};

function isCrisis(text) {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Edinburgh Postnatal Depression Scale (EPDS) scoring
// ---------------------------------------------------------------------------

/**
 * Scores a completed 10-question EPDS survey.
 * Each question is scored 0–3 (some questions reverse-scored before calling this).
 *
 * @param {number[]} answers  Array of 10 scores, each 0–3
 * @returns {{ total: number, riskLevel: string, flag: boolean, highRisk: boolean }}
 */
function scoreEPDS(answers) {
  if (!Array.isArray(answers) || answers.length !== 10) {
    throw new Error('EPDS requires exactly 10 answers scored 0-3');
  }

  const total = answers.reduce((s, v) => s + Math.min(3, Math.max(0, Number(v) || 0)), 0);

  // Clinical cut-offs (EPDS validation literature)
  const highRisk  = total >= 13;
  const flag      = total >= 10;
  const riskLevel = total >= 13 ? 'high' : total >= 10 ? 'elevated' : total >= 7 ? 'low' : 'ok';

  return { total, riskLevel, flag, highRisk };
}

// ---------------------------------------------------------------------------
// Mood pattern analysis
// ---------------------------------------------------------------------------

/**
 * Derives a simple pattern label from recent mood logs.
 * @param {Array<{mood_score: number}>} recentMoods  Latest first
 * @returns {string|null}
 */
function analyzeMoodPattern(recentMoods) {
  if (!recentMoods || recentMoods.length < 3) return null;

  const scores = recentMoods.slice(0, 7).map((m) => Number(m.mood_score) || 3);
  const avg    = scores.reduce((s, v) => s + v, 0) / scores.length;

  if (avg <= 2) return 'consistently_low';
  if (avg >= 4) return 'consistently_positive';

  const first  = scores.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  const last   = scores.slice(-3).reduce((s, v) => s + v, 0) / 3;
  if (last - first > 1)  return 'improving';
  if (first - last > 1)  return 'declining';
  return 'mixed';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MentalHealthInput
 * @property {string}  userId
 * @property {string}  [pregnancyId]
 * @property {string}  mood              e.g. 'anxious', 'sad', 'happy'
 * @property {string}  [note]            Free-text from user
 * @property {number}  [moodScore]       1–5 numeric scale
 * @property {Array}   [recentMoods]     Recent mood_logs rows
 * @property {object}  [profile]         User profile row
 */

/**
 * @typedef {object} MentalHealthResult
 * @property {string}   riskLevel        'ok'|'low'|'elevated'|'high'|'crisis'
 * @property {string}   reflection       Empathetic response text
 * @property {boolean}  ppdScreenSuggested
 * @property {string|null} patternNote
 * @property {string[]} suggestions
 * @property {string}   resourcePrompt
 * @property {boolean}  crisis
 * @property {string}   [logId]
 */

/**
 * Assesses a mood check-in and returns mental-health guidance.
 *
 * @param {MentalHealthInput} input
 * @returns {Promise<MentalHealthResult>}
 */
async function assessMentalHealth(input) {
  const {
    userId,
    pregnancyId = null,
    mood,
    note = '',
    moodScore = 3,
    recentMoods = [],
    profile = {},
  } = input;

  const fullText = [mood, note].filter(Boolean).join(' ');

  // ── Crisis keyword intercept ─────────────────────────────────────────────
  if (isCrisis(fullText)) {
    const logId = await persistMoodLog({ userId, pregnancyId, mood, note, moodScore, aiResult: CRISIS_RESPONSE });
    return { ...CRISIS_RESPONSE, logId };
  }

  // ── AI assessment ────────────────────────────────────────────────────────
  let aiResult;
  try {
    const { system, user: userPrompt } = buildMentalHealthPrompt({
      user:        profile,
      mood,
      note,
      recentMoods,
    });
    aiResult = await jsonCall({ system, userPrompt, maxTokens: 700 });
  } catch (err) {
    aiResult = {
      riskLevel:          'low',
      reflection:         'Thank you for sharing how you feel. It\'s important to check in with yourself.',
      ppdScreenSuggested: false,
      patternNote:        null,
      suggestions:        ['Talk to your midwife or doctor about how you\'re feeling.'],
      resourcePrompt:     '',
    };
    console.error('[mentalHealth] AI call failed:', err.message);
  }

  const moodPattern = analyzeMoodPattern(recentMoods);
  const result = {
    riskLevel:          aiResult.riskLevel          || 'ok',
    reflection:         aiResult.reflection          || '',
    ppdScreenSuggested: aiResult.ppdScreenSuggested  ?? false,
    patternNote:        aiResult.patternNote || moodPattern,
    suggestions:        aiResult.suggestions         || [],
    resourcePrompt:     aiResult.resourcePrompt      || '',
    crisis:             false,
  };

  const logId = await persistMoodLog({ userId, pregnancyId, mood, note, moodScore, aiResult: result });
  return { ...result, logId };
}

// ---------------------------------------------------------------------------
// DB persistence
// ---------------------------------------------------------------------------

async function persistMoodLog({ userId, pregnancyId, mood, note, moodScore, aiResult }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO mood_logs
         (user_id, pregnancy_id, mood, mood_score, note, ai_assessment, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       RETURNING id`,
      [
        userId,
        pregnancyId || null,
        mood,
        moodScore || 3,
        note || null,
        JSON.stringify(aiResult),
      ]
    );
    return rows[0]?.id || null;
  } catch (err) {
    console.error('[mentalHealth] DB persist failed:', err.message);
    return null;
  }
}

module.exports = { assessMentalHealth, scoreEPDS, analyzeMoodPattern, isCrisis };
