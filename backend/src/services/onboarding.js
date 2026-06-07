// services/onboarding.js
// THE FIRST CALL — run this the moment a user completes signup.
// Builds their profile (via the AI), ready to store and reuse.

const { jsonCall } = require('../lib/claude');
const { buildOnboardingPrompt } = require('../prompts/onboardingPrompt');

/**
 * runOnboarding(answers) → userProfile
 *
 * answers: raw object from your onboarding form (see buildOnboardingPrompt for shape)
 *
 * Returns a userProfile object ready to:
 *   1. Store in your database (user_profiles table)
 *   2. Pass to buildSystemPrompt() on every subsequent API call
 */
async function runOnboarding(answers) {
  console.log('[onboarding] Running personalization for new user…');

  const { system, user: userPrompt } = buildOnboardingPrompt(answers);

  // Single API call — returns parsed JSON profile
  const profile = await jsonCall({ system, userPrompt, maxTokens: 800 });

  // Merge the raw answers the model doesn't produce with the AI-generated profile
  const userProfile = {
    // ── AI-generated fields ──────────────────────────────────
    calculatedDueDate: profile.calculatedDueDate,
    currentWeek: profile.currentWeek,
    trimester: profile.trimester,
    highRiskFlag: profile.highRiskFlag,
    highRiskReason: profile.highRiskReason,
    contentTrack: profile.contentTrack,
    featurePriorities: profile.featurePriorities,
    firstTipCategory: profile.firstTipCategory,
    onboardingMessage: profile.onboardingMessage,
    suggestedFirstAction: profile.suggestedFirstAction,
    notifyDoctor: profile.notifyDoctor,
    notifyDoctorReason: profile.notifyDoctorReason,

    // ── Pass-through from signup form ────────────────────────
    country: answers.country ?? 'unknown',
    language: answers.language ?? 'English',
    isFirstPregnancy: answers.isFirst ?? true,
    isIvf: answers.isIvf ?? false,
    age: answers.age,
    goals: answers.goals ?? [],
    healthConditions: answers.conditions ?? [],
    dietaryRestrictions: answers.dietary ?? [],
    notifPref: answers.notifPref ?? 'daily',

    // ── App state (starts empty, updated as user interacts) ──
    recentSymptoms: [],
    partnerMode: false,
    postpartum: false,

    // ── Metadata ─────────────────────────────────────────────
    createdAt: new Date().toISOString(),
  };

  console.log(
    `[onboarding] Done. Week ${userProfile.currentWeek}, track: ${userProfile.contentTrack}, high-risk: ${userProfile.highRiskFlag}`
  );

  return userProfile;
}

module.exports = { runOnboarding };
