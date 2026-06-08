// services/contentGenerator.js
// Build-time content generation helper used by the generateWeeklyContent script
// and the weekContent AI service.

'use strict';

const { jsonCall } = require('../lib/claude');
const db = require('../db');

/**
 * generateWeekContent({ week, track, language, phase })
 * Generates rich development content for a single week via Claude.
 * Returns the parsed JSON object (does NOT persist to DB).
 */
async function generateWeekContent({ week, track = 'standard', language = 'en', phase = 'pregnancy' }) {
  const isNewborn = phase === 'newborn';

  const system = `You are Bloom's week-by-week development content generator for a
global pregnancy and newborn app. Produce accurate, warm, evidence-based content
aligned with WHO, ACOG, and NHS guidance. Respond in language: ${language}.
Return ONLY valid JSON — no preamble, no markdown fences.`;

  const userPrompt = isNewborn
    ? `Generate newborn development content for week ${week} of life.
Language: ${language}. Content track: ${track}.

Return exactly:
{
  "week": ${week},
  "phase": "newborn",
  "developmentSummary": "...",
  "milestones": ["milestone 1", "milestone 2"],
  "feeding": "feeding guidance",
  "sleep": "sleep guidance",
  "parentTips": ["tip 1", "tip 2"],
  "watchFor": ["sign 1", "sign 2"]
}`
    : `Generate pregnancy development content for week ${week} (1-40).
Language: ${language}. Content track: ${track}.

Return exactly:
{
  "week": ${week},
  "trimester": ${week <= 13 ? 1 : week <= 27 ? 2 : 3},
  "babySizeDescription": "size comparison sentence",
  "babySizeFruitComparison": "fruit name",
  "babySizeCm": <crown-rump length in cm>,
  "babyWeightGrams": <weight in grams>,
  "headlineSentence": "exciting headline for this week",
  "developmentHighlights": [
    { "system": "organ system", "detail": "what is forming" }
  ],
  "momBodyChanges": ["change 1", "change 2"],
  "commonSymptoms": [
    { "name": "symptom", "description": "brief", "tip": "relief tip" }
  ],
  "nutritionTips": [{ "tip": "...", "why": "..." }],
  "exerciseGuidance": "movement guidance",
  "appointmentsThisWeek": [
    { "type": "appointment_type", "description": "...", "isRoutine": true }
  ],
  "weeklyChecklist": [
    { "item": "to-do", "category": "health" }
  ],
  "partnerTip": "tip for the partner",
  "affirmation": "affirmation",
  "didYouKnow": "fun fact",
  "sources": ["WHO", "ACOG", "NHS"]
}`;

  return jsonCall({ system, userPrompt, maxTokens: 1200 });
}

/**
 * generateAllWeeks({ track, language, weeks, phase })
 * Generates and upserts content for a range of weeks.
 * Uses the correct pregnancy_weeks_cache table.
 */
async function generateAllWeeks({
  track    = 'standard',
  language = 'en',
  weeks    = Array.from({ length: 40 }, (_, i) => i + 1),
  phase    = 'pregnancy',
} = {}) {
  const results = [];

  for (const week of weeks) {
    console.log(`[content] generating week ${week} (${track}/${language}/${phase})`);
    try {
      const content = await generateWeekContent({ week, track, language, phase });

      await db.query(
        `INSERT INTO pregnancy_weeks_cache
           (week, phase, track, language,
            baby_size_description, baby_size_cm, baby_weight_grams,
            development_highlights, common_symptoms, nutrition_tips,
            appointments_this_week, checklist,
            partner_tip, affirmation, did_you_know, sources, is_stub)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,FALSE)
         ON CONFLICT (week, phase, track, language) DO UPDATE SET
           baby_size_description  = EXCLUDED.baby_size_description,
           baby_size_cm           = EXCLUDED.baby_size_cm,
           baby_weight_grams      = EXCLUDED.baby_weight_grams,
           development_highlights = EXCLUDED.development_highlights,
           common_symptoms        = EXCLUDED.common_symptoms,
           nutrition_tips         = EXCLUDED.nutrition_tips,
           appointments_this_week = EXCLUDED.appointments_this_week,
           checklist              = EXCLUDED.checklist,
           partner_tip            = EXCLUDED.partner_tip,
           affirmation            = EXCLUDED.affirmation,
           did_you_know           = EXCLUDED.did_you_know,
           sources                = EXCLUDED.sources,
           is_stub                = FALSE,
           updated_at             = now()`,
        [
          week, phase, track, language,
          content.babySizeDescription || `Week ${week}`,
          content.babySizeCm          || null,
          content.babyWeightGrams     || null,
          JSON.stringify(content.developmentHighlights  || []),
          JSON.stringify(content.commonSymptoms         || []),
          JSON.stringify(content.nutritionTips          || []),
          JSON.stringify(content.appointmentsThisWeek   || []),
          JSON.stringify(content.weeklyChecklist        || []),
          content.partnerTip  || null,
          content.affirmation || null,
          content.didYouKnow  || null,
          JSON.stringify(content.sources || ['WHO', 'ACOG', 'NHS']),
        ]
      );

      results.push({ week, ok: true });
    } catch (err) {
      console.error(`[content] week ${week} failed:`, err.message);
      results.push({ week, ok: false, error: err.message });
    }
  }

  return results;
}

module.exports = { generateWeekContent, generateAllWeeks };
