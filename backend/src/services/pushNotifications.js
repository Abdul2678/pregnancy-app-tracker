// services/pushNotifications.js
// Manages push notification copy: generation (build-time) and retrieval.

const { jsonCall } = require('../lib/claude');
const db = require('../db');

/**
 * generatePushCopy({ week, language, phase }) → { title, body, category }
 */
async function generatePushCopy({ week, language = 'en', phase = 'pregnancy' }) {
  const system = `You write short, warm push-notification copy for Bloom, a pregnancy app.
Keep titles under 6 words and bodies under 120 characters. Respond in the requested
language. Return ONLY valid JSON — no preamble.`;

  const userPrompt = `Write a weekly push notification for ${
    phase === 'newborn' ? `newborn week ${week} of life` : `pregnancy week ${week}`
  }.
Language: ${language}.

Return exactly:
{ "title": "string", "body": "string", "category": "weekly" }`;

  return jsonCall({ system, userPrompt, maxTokens: 200 });
}

/**
 * generateAllPushCopy({ language, phase, weeks }) — generate + cache copy for a range.
 */
async function generateAllPushCopy({
  language = 'en',
  phase = 'pregnancy',
  weeks = Array.from({ length: 40 }, (_, i) => i + 1),
} = {}) {
  const results = [];
  for (const week of weeks) {
    const copy = await generatePushCopy({ week, language, phase });
    await db.query(
      `INSERT INTO push_notification_copy (week_number, language, phase, title, body, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (week_number, language, phase, category) DO UPDATE
         SET title = EXCLUDED.title, body = EXCLUDED.body`,
      [week, language, phase, copy.title, copy.body, copy.category || 'weekly']
    );
    results.push({ week, ok: true });
  }
  return results;
}

/**
 * getPushCopy({ week, language, phase }) — read cached push copy.
 */
async function getPushCopy({ week, language = 'en', phase = 'pregnancy' }) {
  const { rows } = await db.query(
    `SELECT title, body, category FROM push_notification_copy
     WHERE week_number = $1 AND language = $2 AND phase = $3
     ORDER BY created_at DESC LIMIT 1`,
    [week, language, phase]
  );
  return rows[0] || null;
}

module.exports = { generatePushCopy, generateAllPushCopy, getPushCopy };
