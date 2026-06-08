/**
 * services/ai/onboarding.js
 * AI-powered onboarding personalisation.
 * Analyses the user's intake answers and returns structured pregnancy context.
 *
 * Usage:
 *   const { runOnboarding } = require('./onboarding');
 *   const result = await runOnboarding({ lmpDate: '2025-01-15', country: 'PK', language: 'ur' });
 *   // result.currentWeek, result.dueDate, result.highRiskFlag, ...
 */

'use strict';

const { jsonCall }             = require('../claude');
const { buildOnboardingPrompt } = require('../../prompts/onboardingPrompt');

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} OnboardingAnswers
 * @property {string}  [lmpDate]         Last menstrual period (YYYY-MM-DD)
 * @property {string}  [dueDate]         Provider-given due date (YYYY-MM-DD)
 * @property {boolean} [isIVF]
 * @property {boolean} [isMultiples]
 * @property {string}  [country]         ISO 3166-1 alpha-2
 * @property {string}  [language]        BCP-47
 * @property {number}  [age]
 * @property {string}  [preExisting]     Comma-separated conditions
 * @property {string}  [contentTrack]    'standard' | 'high_risk' | 'multiples'
 */

/**
 * @typedef {object} OnboardingResult
 * @property {string}  calculatedDueDate
 * @property {number}  currentWeek
 * @property {string}  trimester          'first' | 'second' | 'third'
 * @property {boolean} highRiskFlag
 * @property {string|null} highRiskReason
 * @property {string}  contentTrack
 * @property {string[]} featurePriorities
 * @property {string}  firstTipCategory
 * @property {string}  onboardingMessage
 * @property {string}  suggestedFirstAction
 * @property {boolean} notifyDoctor
 * @property {string|null} notifyDoctorReason
 */

// ---------------------------------------------------------------------------
// Fallback calculator (when Claude is unavailable)
// ---------------------------------------------------------------------------

/**
 * Pure JS fallback that derives week/due date from LMP without AI.
 * @param {OnboardingAnswers} answers
 * @returns {Partial<OnboardingResult>}
 */
function fallbackCalculation(answers) {
  const lmp = answers.lmpDate ? new Date(answers.lmpDate) : null;
  if (!lmp || isNaN(lmp)) return {};

  const now        = new Date();
  const daysSinceLMP = Math.floor((now - lmp) / 86_400_000);
  const currentWeek  = Math.max(1, Math.min(42, Math.floor(daysSinceLMP / 7)));
  const dueDate      = new Date(lmp.getTime() + 280 * 86_400_000);

  const trimester = currentWeek <= 13 ? 'first' : currentWeek <= 26 ? 'second' : 'third';

  return {
    calculatedDueDate:    dueDate.toISOString().split('T')[0],
    currentWeek,
    trimester,
    highRiskFlag:         false,
    highRiskReason:       null,
    contentTrack:         answers.contentTrack || (answers.isMultiples ? 'multiples' : 'standard'),
    featurePriorities:    ['weekly_update', 'symptom_tracker', 'kick_counter'],
    firstTipCategory:     'nutrition',
    onboardingMessage:    `Welcome! You are ${currentWeek} weeks pregnant.`,
    suggestedFirstAction: 'complete_profile',
    notifyDoctor:         false,
    notifyDoctorReason:   null,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Runs AI-powered onboarding personalisation for a new user.
 *
 * @param {OnboardingAnswers} answers
 * @returns {Promise<OnboardingResult>}
 */
async function runOnboarding(answers) {
  let aiResult = null;

  try {
    const { system, user: userPrompt } = buildOnboardingPrompt(answers);
    aiResult = await jsonCall({ system, userPrompt, maxTokens: 600 });
  } catch (err) {
    console.warn('[onboarding] AI call failed, using fallback:', err.message);
  }

  // Merge AI result with fallback (AI wins where present)
  const fallback = fallbackCalculation(answers);
  const result   = { ...fallback, ...(aiResult || {}) };

  // Sanity-check required fields
  if (!result.currentWeek)      result.currentWeek      = fallback.currentWeek || 1;
  if (!result.calculatedDueDate) result.calculatedDueDate = fallback.calculatedDueDate || null;
  if (!result.trimester)        result.trimester        = fallback.trimester || 'first';
  if (result.highRiskFlag === undefined) result.highRiskFlag = false;
  if (!result.contentTrack)     result.contentTrack     = 'standard';
  if (!result.onboardingMessage) result.onboardingMessage = fallback.onboardingMessage || 'Welcome!';

  return result;
}

module.exports = { runOnboarding, fallbackCalculation };
