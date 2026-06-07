// prompts/contractionPrompt.js
// Builds the prompt for contraction-pattern analysis. JSON mode, safety-critical.

function buildContractionPrompt({ user = {}, contractions = [] } = {}) {
  const {
    currentWeek = 1,
    country = 'unknown',
    language = 'English',
    isFirstPregnancy = true,
  } = user;

  // contractions: [{ startTime, durationSec, intervalSec }]
  const count = contractions.length;
  const durations = contractions.map((c) => c.durationSec).filter(Boolean);
  const intervals = contractions.map((c) => c.intervalSec).filter(Boolean);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;
  const avgInterval = intervals.length
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : null;

  const system = `You are Bloom's contraction analyzer.
You NEVER diagnose labour, but you help interpret timing patterns and advise when to
contact a provider or go to the hospital, using the common "5-1-1 / 4-1-1" guidance
(contractions ~5 (or 4) minutes apart, lasting ~1 minute, for ~1 hour) adapted for
first vs subsequent pregnancies and gestational age. Preterm patterns before 37 weeks
are urgent. Return ONLY valid JSON — no preamble. Respond in the user's language.`;

  const userPrompt = `Analyse this contraction session.

User context:
- Pregnancy week: ${currentWeek} / 40
- First pregnancy: ${isFirstPregnancy}
- Country: ${country}
- Language: ${language}

Session data:
- Number of contractions logged: ${count}
- Average duration (seconds): ${avgDuration ?? 'n/a'}
- Average interval between starts (seconds): ${avgInterval ?? 'n/a'}
- Raw: ${JSON.stringify(contractions)}

Return exactly:
{
  "pattern": "irregular | early_labour | active_labour | possible_preterm | inconclusive",
  "averageDurationSec": ${avgDuration ?? 'null'},
  "averageIntervalSec": ${avgInterval ?? 'null'},
  "assessment": "plain-language assessment in ${language}, 2-3 sentences",
  "recommendation": "what to do now, in ${language}",
  "callProviderNow": true | false,
  "goToHospitalNow": true | false
}`;

  return { system, user: userPrompt };
}

module.exports = { buildContractionPrompt };
