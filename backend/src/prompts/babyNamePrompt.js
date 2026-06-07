// prompts/babyNamePrompt.js
// Builds the prompt for baby-name suggestions. JSON mode.

function buildBabyNamePrompt({ user = {}, criteria = {} } = {}) {
  const { country = 'unknown', language = 'English' } = user;
  const {
    gender = 'any', // boy | girl | any | neutral
    origin = 'any',
    startsWith = '',
    style = 'any', // classic | modern | unique | traditional
    meaning = '',
    avoid = [],
    count = 10,
  } = criteria;

  const system = `You are Bloom's baby-name suggester.
You generate culturally aware, respectful name suggestions with meanings and origins.
Be sensitive to the user's country and language. Return ONLY valid JSON — no preamble.`;

  const userPrompt = `Suggest baby names matching these criteria.

User context:
- Country: ${country}
- Language: ${language}

Criteria:
- Gender: ${gender}
- Origin preference: ${origin}
- Starts with: ${startsWith || 'any'}
- Style: ${style}
- Desired meaning theme: ${meaning || 'any'}
- Names to avoid: ${avoid.length ? avoid.join(', ') : 'none'}
- How many: ${count}

Return exactly:
{
  "suggestions": [
    {
      "name": "the name",
      "gender": "boy | girl | neutral",
      "origin": "origin/culture",
      "meaning": "meaning",
      "pronunciation": "simple phonetic hint",
      "note": "one short note (e.g. nickname, popularity), or null"
    }
  ]
}`;

  return { system, user: userPrompt };
}

module.exports = { buildBabyNamePrompt };
