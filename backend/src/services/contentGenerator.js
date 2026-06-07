// services/contentGenerator.js
// Build-time content generation: development content for all weeks, push copy,
// and emergency resources are handled here. AI-backed via Anthropic.

const { jsonCall } = require('../lib/claude');
const db = require('../db');

/**
 * generateWeekContent({ week, track, language, phase }) → content object
 * Generates rich development content for a single week.
 */
async function generateWeekContent({ week, track = 'standard', language = 'English', phase = 'pregnancy' }) {
  const isNewborn = phase === 'newborn';

  const system = `You are Bloom's week-by-week development content generator for a
global pregnancy and newborn app. Produce accurate, warm, evidence-based content
aligned with WHO, ACOG, and NHS guidance. Respond in the requested language.
Return ONLY valid JSON — no preamble, no markdown fences.`;

  const userPrompt = isNewborn
    ? `Generate newborn development content for week ${week} of life (0-12).
Language: ${language}. Content track: ${track}.

Return exactly:
{
  "week": ${week},
  "phase": "newborn",
  "developmentSummary": "what's developing at this age, in ${language}",
  "milestones": ["2-4 milestones"],
  "feeding": "feeding guidance in ${language}",
  "sleep": "sleep guidance in ${language}",
  "parentTips": ["2-4 tips"],
  "watchFor": ["signs to contact a provider about"]
}`
    : `Generate pregnancy development content for week ${week} (1-40).
Language: ${language}. Content track: ${track}.

Return exactly:
{
  "week": ${week},
  "trimester": ${week <= 13 ? 1 : week <= 27 ? 2 : 3},
  "babySize": "size description in ${language}",
  "babySizeComparison": "fruit/vegetable comparison",
  "development": "key fetal development this week, in ${language}",
  "momChanges": "changes the pregnant person may notice, in ${language}",
  "tips": ["2-4 actionable tips"],
  "checklist": ["1-3 to-do items for this week"]
}`;

  return jsonCall({ system, userPrompt, maxTokens: 1200 });
}

/**
 * generateAllWeeks({ track, language, weeks, phase }) — generates and caches a range.
 * Defaults to all 40 pregnancy weeks.
 */
async function generateAllWeeks({
  track = 'standard',
  language = 'English',
  weeks = Array.from({ length: 40 }, (_, i) => i + 1),
  phase = 'pregnancy',
} = {}) {
  const results = [];
  for (const week of weeks) {
    // eslint-disable-next-line no-console
    console.log(`[content] generating week ${week} (${track}/${language}/${phase})`);
    const content = await generateWeekContent({ week, track, language, phase });
    await db.query(
      `INSERT INTO weekly_content (week, track, language, phase, content)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (week, track, language, phase) DO UPDATE SET content = EXCLUDED.content`,
      [week, track, language, phase, JSON.stringify(content)]
    );
    results.push({ week, ok: true });
  }
  return results;
}

module.exports = { generateWeekContent, generateAllWeeks };
