// jobs/symptomPatternJob.js
// Weekly cron job: analyse each active user's recent symptoms for patterns
// and flag anything that may warrant provider follow-up.

const cron = require('node-cron');
const db = require('../db');
const { jsonCall } = require('../lib/claude');
const { rowToProfile } = require('../services/profiles');

async function analyseUserSymptoms(userId, profile, symptoms) {
  const system = `You are Bloom's symptom-pattern analyst. You review a week of logged
symptoms and surface trends, NOT diagnoses. Flag anything that may warrant contacting a
provider. Return ONLY valid JSON — no preamble.`;
  const user = `Analyse this user's symptoms from the past week.

Pregnancy week: ${profile.currentWeek ?? 'unknown'}
Health conditions: ${(profile.healthConditions || []).join(', ') || 'none'}
Symptoms: ${JSON.stringify(symptoms)}

Return exactly:
{
  "trends": ["observed patterns"],
  "flagForProvider": true | false,
  "flagReason": "string or null",
  "weeklyInsight": "one supportive sentence"
}`;
  return jsonCall({ system, userPrompt: user, maxTokens: 500 });
}

/**
 * runSymptomPatternJob() — run once over all users with recent symptoms.
 */
async function runSymptomPatternJob() {
  console.log('[job:symptomPattern] starting weekly run');

  const { rows: users } = await db.query(
    `SELECT DISTINCT user_id FROM symptom_logs WHERE logged_at > now() - interval '7 days'`
  );

  let processed = 0;
  for (const { user_id: userId } of users) {
    try {
      const [{ rows: symptoms }, { rows: profileRows }] = await Promise.all([
        db.query(
          `SELECT symptom_name, description, severity, duration_hours, logged_at
           FROM symptom_logs
           WHERE user_id = $1 AND logged_at > now() - interval '7 days'
           ORDER BY logged_at ASC`,
          [userId]
        ),
        db.query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]),
      ]);

      if (!symptoms.length) continue;

      const profile  = rowToProfile(profileRows[0]);
      const analysis = await analyseUserSymptoms(userId, profile, symptoms);

      // Store the insight on the most recent symptom row as a rolling weekly summary.
      await db.query(
        `UPDATE symptom_logs
         SET ai_triage_result = COALESCE(ai_triage_result, '{}'::jsonb) || $2::jsonb
         WHERE id = (
           SELECT id FROM symptom_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1
         )`,
        [userId, JSON.stringify({ weeklyPattern: analysis })]
      );

      processed += 1;
    } catch (err) {
      console.error(`[job:symptomPattern] failed for user ${userId}`, err.message);
    }
  }

  console.log(`[job:symptomPattern] done — processed ${processed} users`);
  return { processed };
}

/**
 * scheduleSymptomPatternJob() — schedule weekly (Mondays 06:00). Returns the task.
 */
function scheduleSymptomPatternJob() {
  const expr = process.env.SYMPTOM_JOB_CRON || '0 6 * * 1';
  const task = cron.schedule(expr, () => {
    runSymptomPatternJob().catch((err) => {
      console.error('[job:symptomPattern] unhandled error', err);
    });
  });
  console.log(`[job:symptomPattern] scheduled (${expr})`);
  return task;
}

module.exports = { runSymptomPatternJob, scheduleSymptomPatternJob };
