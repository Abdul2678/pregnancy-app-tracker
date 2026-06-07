// prompts/onboardingPrompt.js
// Builds the onboarding personalization prompt from raw signup answers.
// Returns: { system, user } — pass both directly to the Anthropic API.

function buildOnboardingPrompt(answers = {}) {
  const {
    dateInput, // ISO date string
    dateType, // "lmp" | "due_date" | "ivf_transfer"
    isIvf = false,
    isFirst = true,
    previousCount = 0,
    outcomes = [], // ["live_birth", "miscarriage", ...]
    age,
    country = 'unknown',
    language = 'English',
    goals = [], // ["track_symptoms","learn","community","partner_connect","medical_track"]
    conditions = [], // ["none","gestational_diabetes","hypertension","thyroid","other"]
    dietary = [],
    notifPref = 'daily',
  } = answers;

  const system = `You are a pregnancy app onboarding engine.
Your job is to process new user signup data and return a JSON personalisation profile.
Return ONLY valid JSON — no preamble, no markdown fences, no explanation.`;

  const user = `A new user just completed onboarding. Build their personalisation profile.

Onboarding answers:
- Date input: "${dateInput}" (type: "${dateType}")
- IVF: ${isIvf}
- First pregnancy: ${isFirst}
- Previous pregnancies: ${previousCount}, outcomes: ${JSON.stringify(outcomes)}
- Age: ${age ?? 'not provided'}
- Country: "${country}"
- Language: "${language}"
- Goals: ${JSON.stringify(goals)}
- Health conditions: ${JSON.stringify(conditions)}
- Dietary restrictions: ${JSON.stringify(dietary)}
- Notification preference: "${notifPref}"

Return this exact JSON structure:
{
  "calculatedDueDate": "ISO date string",
  "currentWeek": number (1-40),
  "trimester": 1 | 2 | 3,
  "highRiskFlag": true | false,
  "highRiskReason": "string or null",
  "contentTrack": "standard | high_risk | ivf | multiples",
  "featurePriorities": ["ordered list of 5 feature keys to highlight"],
  "firstTipCategory": "most relevant category for day 1",
  "onboardingMessage": "warm personalised welcome message (3 sentences max)",
  "suggestedFirstAction": "first thing to prompt the user to do in app",
  "notifyDoctor": true | false,
  "notifyDoctorReason": "string or null"
}`;

  return { system, user };
}

module.exports = { buildOnboardingPrompt };
