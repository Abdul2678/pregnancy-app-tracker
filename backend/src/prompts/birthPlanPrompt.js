// prompts/birthPlanPrompt.js
// Builds the prompt for the birth-plan builder. JSON mode.

function buildBirthPlanPrompt({ user = {}, preferences = {} } = {}) {
  const {
    currentWeek = 1,
    country = 'unknown',
    language = 'English',
    healthConditions = [],
    contentTrack = 'standard',
  } = user;

  const system = `You are Bloom's birth-plan builder.
You help users articulate their preferences for labour and birth into a clear,
shareable document. You NEVER override medical advice — frame everything as
"preferences to discuss with your care team". Birth options vary by country and
facility; tailor to the user's country. Return ONLY valid JSON — no preamble.
Respond in the user's language.`;

  const userPrompt = `Build a structured birth plan from these preferences.

User context:
- Pregnancy week: ${currentWeek} / 40
- Country: ${country}
- Language: ${language}
- Health conditions: ${healthConditions.length ? healthConditions.join(', ') : 'none'}
- Content track: ${contentTrack}

User preferences (free-form or keyed):
${JSON.stringify(preferences, null, 2)}

Return exactly:
{
  "title": "My Birth Preferences",
  "sections": [
    {
      "heading": "section name (e.g. Environment, Pain Relief, Labour, Delivery, After Birth)",
      "preferences": ["clear preference statements in ${language}"],
      "discussWithProvider": ["items to raise with the care team"]
    }
  ],
  "summary": "2-3 sentence summary in ${language}",
  "countryNotes": "any country-specific notes about birth options in ${country}, or null"
}`;

  return { system, user: userPrompt };
}

module.exports = { buildBirthPlanPrompt };
