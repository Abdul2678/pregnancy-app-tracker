// services/weeklyContent.js
// Serves cached weekly development content from the DB, with a graceful fallback
// to generating + caching content on a miss.

const db = require('../db');
const { generateWeekContent } = require('./contentGenerator');

/**
 * getWeekContent({ week, track, language, phase }) → content object
 * Reads from weekly_content; if missing, generates and caches it.
 */
async function getWeekContent({ week, track = 'standard', language = 'English', phase = 'pregnancy' }) {
  const { rows } = await db.query(
    `SELECT content FROM weekly_content
     WHERE week = $1 AND track = $2 AND language = $3 AND phase = $4
     LIMIT 1`,
    [week, track, language, phase]
  );

  if (rows.length) return rows[0].content;

  // Cache miss — generate on demand and persist.
  const content = await generateWeekContent({ week, track, language, phase });
  await db.query(
    `INSERT INTO weekly_content (week, track, language, phase, content)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (week, track, language, phase) DO UPDATE SET content = EXCLUDED.content`,
    [week, track, language, phase, JSON.stringify(content)]
  );
  return content;
}

module.exports = { getWeekContent };
