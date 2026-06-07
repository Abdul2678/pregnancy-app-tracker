// services/symptomTriage.js
// Processes a symptom log: runs AI triage and persists the result.

const { jsonCall } = require('../lib/claude');
const { buildSymptomTriagePrompt } = require('../prompts/symptomTriagePrompt');
const db = require('../db');

/**
 * triageSymptom({ userId, profile, symptomText, severity, durationHours })
 * Returns the persisted symptom row including the triage result.
 */
async function triageSymptom({ userId, profile = {}, symptomText, severity, durationHours }) {
  const { system, user } = buildSymptomTriagePrompt({
    user: profile,
    symptomText,
    severity,
    durationHours,
  });

  const triage = await jsonCall({ system, userPrompt: user, maxTokens: 700 });

  const { rows } = await db.query(
    `INSERT INTO symptoms (user_id, symptom_text, severity, duration_hours, week, triage_result)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      symptomText,
      severity ?? null,
      durationHours ?? null,
      profile.currentWeek ?? null,
      JSON.stringify(triage),
    ]
  );

  return { ...rows[0], triage_result: triage };
}

module.exports = { triageSymptom };
