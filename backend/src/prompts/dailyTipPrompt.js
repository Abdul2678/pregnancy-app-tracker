// prompts/dailyTipPrompt.js
// Builds the prompt for a daily personalized tip, localized to the user.

function buildDailyTipPrompt(user = {}) {
  const {
    currentWeek = 1,
    trimester = 1,
    country = 'unknown',
    language = 'English',
    firstTipCategory = 'general',
    recentSymptoms = [],
    dietaryRestrictions = [],
    healthConditions = [],
    contentTrack = 'standard',
  } = user;

  const system = `You are Bloom's daily tip engine for a global pregnancy app.
Return ONLY valid JSON — no preamble, no markdown fences.
All advice must align with WHO, ACOG, or NHS guidelines and be culturally appropriate
for the user's country. Respond in the user's language.`;

  const userPrompt = `Generate today's personalised tip for this user.

Context:
- Pregnancy week: ${currentWeek} / 40 (trimester ${trimester})
- Country: ${country}
- Language: ${language}
- Content track: ${contentTrack}
- Preferred tip category: ${firstTipCategory}
- Recent symptoms: ${recentSymptoms.length ? recentSymptoms.join(', ') : 'none'}
- Dietary restrictions: ${dietaryRestrictions.length ? dietaryRestrictions.join(', ') : 'none'}
- Health conditions: ${healthConditions.length ? healthConditions.join(', ') : 'none'}

Return exactly:
{
  "title": "short headline (max 8 words)",
  "body": "the tip, 2-3 sentences, warm and actionable, in ${language}",
  "category": "nutrition | movement | wellbeing | preparation | symptom | partner",
  "weekRelevance": ${currentWeek}
}`;

  return { system, user: userPrompt };
}

module.exports = { buildDailyTipPrompt };
