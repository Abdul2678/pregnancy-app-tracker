/**
 * services/ai/birthPlan.js
 * Generates a personalised birth plan document using AI.
 * Returns structured sections suitable for display and PDF export.
 *
 * Usage:
 *   const { generateBirthPlan } = require('./birthPlan');
 *   const plan = await generateBirthPlan({
 *     userId, profile, preferences: { painManagement: ['epidural'], skinToSkin: true }
 *   });
 *   // plan.generatedPlan (string), plan.sections (array), plan.summary
 */

'use strict';

const { jsonCall }               = require('../claude');
const { buildBirthPlanPrompt }   = require('../../prompts/birthPlanPrompt');
const { getProfile }             = require('../profiles');

// ---------------------------------------------------------------------------
// Default preferences
// ---------------------------------------------------------------------------

const DEFAULTS = {
  painManagement:       [],
  birthEnvironment:     'hospital',
  supportPeople:        [],
  mobilityDuringLabour: 'free_movement',
  waterBirth:           false,
  delayedCordClamping:  true,
  placentaPreferences:  'none',
  deliveryPosition:     'guided_by_provider',
  episiotomy:           'avoid_if_possible',
  skinToSkin:           true,
  feedingIntention:     'unsure',
  vit_k:                'injection',
  eyeDrops:             true,
  delayedBathing:       true,
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {object} BirthPlanResult
 * @property {string}   generatedPlan  Full narrative text
 * @property {Array}    sections       [{heading, preferences[], discussWithProvider[]}]
 * @property {string}   summary        One-paragraph summary
 * @property {string}   [countryNotes] Country-specific notes
 */

/**
 * Generates a birth plan document.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} [opts.profile]
 * @param {object} [opts.preferences]  User's birth preferences
 * @returns {Promise<BirthPlanResult>}
 */
async function generateBirthPlan({ userId, profile, preferences = {} }) {
  // Fetch profile from DB if not provided
  const resolvedProfile = profile || (await getProfile(userId)) || {};

  const mergedPrefs = { ...DEFAULTS, ...preferences };

  let aiResult;
  try {
    const { system, user: userPrompt } = buildBirthPlanPrompt({
      user:        resolvedProfile,
      preferences: mergedPrefs,
    });
    aiResult = await jsonCall({ system, userPrompt, maxTokens: 1800 });
  } catch (err) {
    console.error('[birthPlan] AI call failed:', err.message);
    aiResult = buildFallbackPlan(mergedPrefs, resolvedProfile);
  }

  return {
    generatedPlan: aiResult.generatedPlan || aiResult.plan || '',
    sections:      aiResult.sections      || [],
    summary:       aiResult.summary       || '',
    countryNotes:  aiResult.countryNotes  || null,
  };
}

// ---------------------------------------------------------------------------
// Fallback plan builder
// ---------------------------------------------------------------------------

/**
 * Creates a simple template plan when AI is unavailable.
 * @param {object} prefs
 * @param {object} profile
 * @returns {BirthPlanResult}
 */
function buildFallbackPlan(prefs, profile) {
  const name = profile.displayName || profile.display_name || 'My';

  const painList = prefs.painManagement?.length
    ? prefs.painManagement.join(', ')
    : 'as advised by care team';

  const sections = [
    {
      heading:     'Labour Pain Management',
      preferences: [`Preferred pain relief: ${painList}`],
      discussWithProvider: ['Discuss availability of preferred options at your birth location'],
    },
    {
      heading:     'Delivery Preferences',
      preferences: [
        prefs.delayedCordClamping ? 'Delayed cord clamping requested' : 'Standard cord clamping',
        prefs.skinToSkin ? 'Immediate skin-to-skin contact requested' : '',
      ].filter(Boolean),
      discussWithProvider: [],
    },
    {
      heading:     'Newborn Care',
      preferences: [
        `Feeding intention: ${prefs.feedingIntention}`,
        prefs.delayedBathing ? 'Delayed first bath requested' : '',
      ].filter(Boolean),
      discussWithProvider: [],
    },
  ];

  return {
    generatedPlan: `This is ${name}'s birth plan.\n\n` +
      sections.map((s) => `## ${s.heading}\n${s.preferences.join('\n')}`).join('\n\n'),
    sections,
    summary: 'A personalised birth plan based on your preferences.',
    countryNotes: null,
  };
}

module.exports = { generateBirthPlan };
