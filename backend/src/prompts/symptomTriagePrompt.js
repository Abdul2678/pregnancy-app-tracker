// prompts/symptomTriagePrompt.js
// Builds the prompt for safety-critical symptom triage. JSON mode.

function buildSymptomTriagePrompt({ user = {}, symptomText, severity, durationHours } = {}) {
  const {
    currentWeek = 1,
    trimester = 1,
    healthConditions = [],
    contentTrack = 'standard',
    language = 'English',
    country = 'unknown',
  } = user;

  const system = `You are Bloom's pregnancy safety triage assistant.
You NEVER diagnose or prescribe. You assess urgency and give clear next steps.
Return ONLY valid JSON — no preamble, no markdown fences.
Respond in the user's language. Align with WHO, ACOG, and NHS guidance.
If the symptom matches a red-flag emergency, set severity to "emergency" and
instruct the user to seek emergency care immediately.`;

  const userPrompt = `Assess this reported symptom.

User context:
- Pregnancy week: ${currentWeek} / 40 (trimester ${trimester})
- Health conditions: ${healthConditions.length ? healthConditions.join(', ') : 'none'}
- Content track: ${contentTrack}
- Country: ${country}
- Language: ${language}

Reported symptom: "${symptomText}"
User-reported severity (1-5): ${severity ?? 'not provided'}
Duration (hours): ${durationHours ?? 'not provided'}

Return exactly:
{
  "severity": "self_care | monitor | call_provider | urgent | emergency",
  "explanation": "plain-language explanation in ${language}, 2-3 sentences",
  "actionSteps": ["ordered list of what to do now"],
  "whenToEscalate": "specific signs that mean call a provider / go to hospital",
  "reassurance": "one warm reassuring sentence (omit if emergency)"
}`;

  return { system, user: userPrompt };
}

module.exports = { buildSymptomTriagePrompt };
