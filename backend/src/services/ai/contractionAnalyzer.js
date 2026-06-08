/**
 * services/ai/contractionAnalyzer.js
 * Analyses a contraction session against the 5-1-1 rule and other clinical
 * patterns. Returns go_to_hospital flag and AI-generated recommendation.
 *
 * 5-1-1 rule: contractions every 5 min, lasting ≥1 min, for ≥1 hour
 *
 * Usage:
 *   const { analyzeContractions } = require('./contractionAnalyzer');
 *   const result = await analyzeContractions({
 *     userId, sessionId, events, gestationalWeek: 38, profile
 *   });
 *   // result.goToHospital, result.callProviderNow, result.pattern
 */

'use strict';

const db = require('../../db');
const { jsonCall }                    = require('../claude');
const { buildContractionPrompt }      = require('../../prompts/contractionPrompt');

// ---------------------------------------------------------------------------
// 5-1-1 rule evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates whether contractions meet the 5-1-1 hospital rule.
 *
 * @param {Array<{startedAt: string, endedAt: string|null, durationSec: number|null}>} events
 * @param {number} week  Gestational week
 * @returns {{ meets511: boolean, avgIntervalSec: number|null, avgDurationSec: number|null, spanMinutes: number }}
 */
function evaluate511(events, week) {
  if (!events || events.length < 3) {
    return { meets511: false, avgIntervalSec: null, avgDurationSec: null, spanMinutes: 0 };
  }

  // Sort chronologically
  const sorted = [...events].sort((a, b) =>
    new Date(a.startedAt || a.started_at) - new Date(b.startedAt || b.started_at)
  );

  // Intervals (time between starts)
  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].startedAt || sorted[i - 1].started_at);
    const curr = new Date(sorted[i].startedAt     || sorted[i].started_at);
    intervals.push((curr - prev) / 1000);
  }

  // Durations
  const durations = sorted
    .map((e) => {
      if (e.durationSec || e.duration_sec) return e.durationSec || e.duration_sec;
      if (e.endedAt || e.ended_at) {
        return (new Date(e.endedAt || e.ended_at) - new Date(e.startedAt || e.started_at)) / 1000;
      }
      return null;
    })
    .filter(Boolean);

  const avgIntervalSec  = intervals.length  ? intervals.reduce((s, v) => s + v, 0) / intervals.length  : null;
  const avgDurationSec  = durations.length  ? durations.reduce((s, v) => s + v, 0) / durations.length  : null;

  // Session span (minutes from first to last contraction)
  const first   = new Date(sorted[0].startedAt || sorted[0].started_at);
  const last    = new Date(sorted[sorted.length - 1].startedAt || sorted[sorted.length - 1].started_at);
  const spanMinutes = (last - first) / 60_000;

  // 5-1-1: avg interval ≤5 min, avg duration ≥60 sec, sustained for ≥60 min
  const meets511 =
    avgIntervalSec !== null &&
    avgDurationSec !== null &&
    avgIntervalSec <= 300 &&   // 5 minutes
    avgDurationSec >= 60  &&   // 1 minute
    spanMinutes     >= 60;     // 1 hour

  // Preterm alert (before 37 weeks, any regular pattern is concerning)
  const pretermAlert = week && week < 37 && avgIntervalSec !== null && avgIntervalSec <= 600;

  return { meets511, pretermAlert, avgIntervalSec, avgDurationSec, spanMinutes };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ContractionInput
 * @property {string}  userId
 * @property {string}  [sessionId]        contraction_sessions row id
 * @property {Array}   events             contraction_events rows or raw objects
 * @property {number}  [gestationalWeek]  For preterm detection
 * @property {object}  [profile]
 */

/**
 * @typedef {object} ContractionResult
 * @property {string}   pattern            'irregular'|'early_labour'|'active_labour'|'preterm'
 * @property {number|null} averageDurationSec
 * @property {number|null} averageIntervalSec
 * @property {string}   assessment
 * @property {string}   recommendation
 * @property {boolean}  callProviderNow
 * @property {boolean}  goToHospital
 * @property {boolean}  meets511
 * @property {boolean}  pretermAlert
 */

/**
 * Analyses a contraction session and returns clinical guidance.
 *
 * @param {ContractionInput} input
 * @returns {Promise<ContractionResult>}
 */
async function analyzeContractions(input) {
  const {
    userId,
    sessionId = null,
    events    = [],
    gestationalWeek = null,
    profile   = {},
  } = input;

  const week = gestationalWeek || profile.currentWeek || null;

  // ── Local 5-1-1 evaluation ───────────────────────────────────────────────
  const local = evaluate511(events, week);

  // ── AI analysis ──────────────────────────────────────────────────────────
  let aiResult;
  try {
    const { system, user: userPrompt } = buildContractionPrompt({
      user:        profile,
      events,
      currentWeek: week,
    });
    aiResult = await jsonCall({ system, userPrompt, maxTokens: 600 });
  } catch (err) {
    // Fallback based purely on local calculation
    aiResult = {
      pattern:        local.meets511 ? 'active_labour' : local.pretermAlert ? 'preterm' : 'irregular',
      assessment:     local.meets511
        ? 'Your contractions meet the 5-1-1 pattern. Consider heading to the hospital.'
        : 'Contractions do not yet meet the hospital threshold.',
      recommendation: local.meets511
        ? 'Contact your provider or go to the hospital.'
        : 'Continue timing contractions and rest.',
      callProviderNow: local.pretermAlert || local.meets511,
      goToHospitalNow: local.meets511,
    };
    console.error('[contractionAnalyzer] AI call failed:', err.message);
  }

  const result = {
    pattern:           aiResult.pattern          || 'irregular',
    averageDurationSec: local.avgDurationSec,
    averageIntervalSec: local.avgIntervalSec,
    spanMinutes:        local.spanMinutes,
    assessment:         aiResult.assessment       || '',
    recommendation:     aiResult.recommendation   || '',
    callProviderNow:    aiResult.callProviderNow  ?? (local.pretermAlert || local.meets511),
    goToHospital:       aiResult.goToHospitalNow  ?? local.meets511,
    meets511:           local.meets511,
    pretermAlert:       local.pretermAlert || false,
  };

  // ── Persist result to session ────────────────────────────────────────────
  if (sessionId) {
    try {
      await db.query(
        `UPDATE contraction_sessions
         SET avg_duration_sec = $1, avg_interval_sec = $2,
             ai_assessment = $3, updated_at = now()
         WHERE id = $4 AND user_id = $5`,
        [
          local.avgDurationSec,
          local.avgIntervalSec,
          JSON.stringify(result),
          sessionId,
          userId,
        ]
      );
    } catch (err) {
      console.error('[contractionAnalyzer] DB update failed:', err.message);
    }
  }

  return result;
}

module.exports = { analyzeContractions, evaluate511 };
