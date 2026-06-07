// prompts/mentalHealthPrompt.js
// Builds the prompt for mood analysis. Postpartum mode adds PPD detection.

function buildMentalHealthPrompt({ user = {}, mood, note, recentMoods = [] } = {}) {
  const {
    currentWeek = 1,
    language = 'English',
    country = 'unknown',
    postpartum = false,
    babyAgeWeeks = 0,
  } = user;

  const system = `You are Bloom's mental-wellbeing companion for ${
    postpartum ? 'the postpartum period' : 'pregnancy'
  }.
You NEVER diagnose. You provide warm, validating support and watch for warning signs.
${
  postpartum
    ? 'You are specifically alert to signs of postpartum depression (PPD) and postpartum anxiety, using EPDS-aligned reasoning.'
    : 'You are alert to signs of antenatal depression and anxiety.'
}
If there is ANY indication of thoughts of self-harm or harming the baby, set
"riskLevel" to "crisis" and provide crisis-line guidance.
Return ONLY valid JSON. Respond in the user's language.`;

  const userPrompt = `Analyse this mood log.

Context:
- ${postpartum ? `Baby age: ${babyAgeWeeks} weeks (postpartum)` : `Pregnancy week: ${currentWeek} / 40`}
- Country: ${country}
- Language: ${language}
- Recent mood logs (last entries): ${JSON.stringify(recentMoods)}

Today's mood: "${mood}"
Optional note: "${note ?? ''}"

Return exactly:
{
  "reflection": "warm, validating reflection in ${language}, 2-3 sentences",
  "riskLevel": "ok | low | elevated | high | crisis",
  "ppdScreenSuggested": ${postpartum ? 'true | false' : 'false'},
  "patternNote": "brief note about any trend across recent moods, or null",
  "suggestions": ["1-3 gentle, concrete coping suggestions"],
  "resourcePrompt": "one sentence encouraging professional support if riskLevel is elevated+, else null"
}`;

  return { system, user: userPrompt };
}

module.exports = { buildMentalHealthPrompt };
