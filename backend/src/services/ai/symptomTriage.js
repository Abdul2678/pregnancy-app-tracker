/**
 * services/ai/symptomTriage.js
 * AI-powered symptom triage with emergency-keyword intercept.
 * Persists results to symptom_logs table.
 *
 * Usage:
 *   const { triageSymptom } = require('./symptomTriage');
 *   const result = await triageSymptom({
 *     userId, pregnancyId, symptomText: 'severe headache and blurry vision',
 *     severity: 'severe', durationHours: 2, profile
 *   });
 *   // result.severity: 'emergency' | 'urgent' | 'call_provider' | 'monitor' | 'self_care'
 *   // result.goToHospital: true/false
 */

'use strict';

const db = require('../../db');
const { jsonCall }                   = require('../claude');
const { buildSymptomTriagePrompt }   = require('../../prompts/symptomTriagePrompt');

// ---------------------------------------------------------------------------
// Emergency keyword intercept
// ---------------------------------------------------------------------------

const EMERGENCY_PATTERNS = [
  /heavy\s+bleed/i,
  /soaking\s+(a\s+)?pad/i,
  /no\s+(fetal\s+)?movement/i,
  /not\s+moving/i,
  /chest\s+pain/i,
  /can'?t\s+breath/i,
  /difficulty\s+breath/i,
  /severe\s+abdom/i,
  /passed?\s+out/i,
  /faint(ed|ing)/i,
  /blurr(ed|y)\s+(vision|sight)/i,
  /seeing\s+spots/i,
  /sudden\s+severe\s+headache/i,
  /water\s+(broke|breaking)/i,
  /preterm\s+lab/i,
  /contracting\s+before\s+37/i,
  /seizure/i,
  /miscarri/i,
  /placenta\s+abruption/i,
];

const EMERGENCY_RESPONSE = {
  severity:        'emergency',
  triageLevel:     'EMERGENCY',
  goToHospital:    true,
  callProviderNow: true,
  explanation:     'Your symptom may indicate a serious emergency.',
  actionSteps: [
    'Call your local emergency number immediately (911 / 999 / 112 or your country\'s number).',
    'Go to the nearest hospital emergency department.',
    'Do not drive yourself — ask someone to take you or call an ambulance.',
  ],
  whenToEscalate: 'Go now — do not wait.',
  reassurance:    'Medical teams are trained for this. Seeking help quickly is the right decision.',
  intercepted:    true,
};

/**
 * Returns true if symptomText triggers an emergency intercept.
 * @param {string} text
 * @returns {boolean}
 */
function isEmergency(text) {
  return EMERGENCY_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Severity normaliser
// ---------------------------------------------------------------------------

const SEVERITY_MAP = {
  emergency:     'emergency',
  urgent:        'urgent',
  call_provider: 'call_provider',
  monitor:       'monitor',
  self_care:     'self_care',
  // Legacy / alternate labels from prompt
  EMERGENCY:     'emergency',
  URGENT:        'urgent',
  CALL_DOCTOR:   'call_provider',
  MONITOR:       'monitor',
  NORMAL:        'self_care',
};

function normaliseSeverity(raw) {
  return SEVERITY_MAP[raw] || 'monitor';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TriageInput
 * @property {string}  userId
 * @property {string}  [pregnancyId]
 * @property {string}  symptomText        Free-text description
 * @property {string}  [symptomName]      Short label, e.g. "headache"
 * @property {string}  [severity]         User-reported: 'mild'|'moderate'|'severe'
 * @property {number}  [durationHours]
 * @property {string}  [bodyLocation]
 * @property {string}  [notes]
 * @property {object}  [profile]          User profile row
 */

/**
 * @typedef {object} TriageResult
 * @property {string}   severity          Normalised triage level
 * @property {string}   triageLevel       Upper-case version for display
 * @property {boolean}  goToHospital
 * @property {boolean}  callProviderNow
 * @property {string}   explanation
 * @property {string[]} actionSteps
 * @property {string}   whenToEscalate
 * @property {string}   reassurance
 * @property {boolean}  intercepted       true if emergency keyword bypass
 * @property {string}   [logId]           DB row id of the persisted symptom_log
 */

/**
 * Triages a symptom report using AI (or emergency intercept).
 * Persists the log entry to symptom_logs.
 *
 * @param {TriageInput} input
 * @returns {Promise<TriageResult>}
 */
async function triageSymptom(input) {
  const {
    userId,
    pregnancyId = null,
    symptomText,
    symptomName = null,
    severity: reportedSeverity = 'mild',
    durationHours = null,
    bodyLocation = null,
    notes = null,
    profile = {},
  } = input;

  // ── Emergency keyword intercept ──────────────────────────────────────────
  if (isEmergency(symptomText)) {
    const logId = await persistLog({
      userId, pregnancyId, symptomText, symptomName, reportedSeverity,
      durationHours, bodyLocation, notes,
      triageResult: EMERGENCY_RESPONSE,
    });
    return { ...EMERGENCY_RESPONSE, logId };
  }

  // ── AI triage ────────────────────────────────────────────────────────────
  let aiResult;
  try {
    const { system, user: userPrompt } = buildSymptomTriagePrompt({
      user:          profile,
      symptomText,
      severity:      reportedSeverity,
      durationHours,
    });
    aiResult = await jsonCall({ system, userPrompt, maxTokens: 700 });
  } catch (err) {
    // On AI failure, default to "monitor" with generic advice
    aiResult = {
      severity:        'monitor',
      explanation:     'We could not assess this automatically. Please contact your healthcare provider.',
      actionSteps:     ['Contact your midwife or obstetrician.'],
      whenToEscalate:  'If symptoms worsen, seek care immediately.',
      reassurance:     'When in doubt, it is always safe to call your provider.',
    };
    console.error('[symptomTriage] AI call failed:', err.message);
  }

  const normSeverity = normaliseSeverity(aiResult.severity);
  const result = {
    severity:        normSeverity,
    triageLevel:     normSeverity.toUpperCase().replace('_', ' '),
    goToHospital:    normSeverity === 'emergency',
    callProviderNow: normSeverity === 'emergency' || normSeverity === 'urgent',
    explanation:     aiResult.explanation     || '',
    actionSteps:     aiResult.actionSteps     || [],
    whenToEscalate:  aiResult.whenToEscalate  || '',
    reassurance:     aiResult.reassurance     || '',
    intercepted:     false,
  };

  const logId = await persistLog({
    userId, pregnancyId, symptomText, symptomName, reportedSeverity,
    durationHours, bodyLocation, notes,
    triageResult: result,
  });

  return { ...result, logId };
}

// ---------------------------------------------------------------------------
// DB persistence
// ---------------------------------------------------------------------------

/**
 * Inserts a row into symptom_logs and returns the new row id.
 * Silently swallows DB errors so a DB failure never blocks the API response.
 */
async function persistLog({
  userId, pregnancyId, symptomText, symptomName, reportedSeverity,
  durationHours, bodyLocation, notes, triageResult,
}) {
  try {
    const { rows } = await db.query(
      `INSERT INTO symptom_logs
         (user_id, pregnancy_id, symptom_name, description, severity,
          duration_hours, body_location, notes, ai_triage_result, logged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       RETURNING id`,
      [
        userId,
        pregnancyId || null,
        symptomName || symptomText.slice(0, 100),
        symptomText,
        reportedSeverity || 'mild',
        durationHours || null,
        bodyLocation || null,
        notes || null,
        JSON.stringify(triageResult),
      ]
    );
    return rows[0]?.id || null;
  } catch (err) {
    console.error('[symptomTriage] DB persist failed:', err.message);
    return null;
  }
}

module.exports = { triageSymptom, isEmergency, EMERGENCY_RESPONSE };
