// prompts/weightGuidancePrompt.js
// Builds the prompt for weight-gain guidance. JSON mode.

function buildWeightGuidancePrompt({ user = {}, weightKg, prePregnancyWeightKg, heightCm } = {}) {
  const {
    currentWeek = 1,
    trimester = 1,
    language = 'English',
    country = 'unknown',
    healthConditions = [],
    contentTrack = 'standard',
  } = user;

  const system = `You are Bloom's pregnancy weight-guidance assistant.
You NEVER shame or diagnose. You give supportive, evidence-based context on healthy
gestational weight gain, aligned with IOM/NAM, WHO, ACOG, and NHS ranges.
Return ONLY valid JSON — no preamble, no markdown fences. Respond in the user's language.`;

  const userPrompt = `Provide weight guidance for this log.

Context:
- Pregnancy week: ${currentWeek} / 40 (trimester ${trimester})
- Pre-pregnancy weight (kg): ${prePregnancyWeightKg ?? 'not provided'}
- Height (cm): ${heightCm ?? 'not provided'}
- Health conditions: ${healthConditions.length ? healthConditions.join(', ') : 'none'}
- Content track: ${contentTrack}
- Country: ${country}
- Language: ${language}

Today's weight (kg): ${weightKg ?? 'not provided'}

Return exactly:
{
  "status": "below_range | within_range | above_range | unknown",
  "expectedRangeKg": "expected total-gain range for this week as a string, or null",
  "message": "warm, non-judgmental message in ${language}, 2-3 sentences",
  "tips": ["1-3 practical, supportive tips"],
  "flagForProvider": true | false,
  "flagReason": "string or null"
}`;

  return { system, user: userPrompt };
}

module.exports = { buildWeightGuidancePrompt };
