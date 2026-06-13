// tests/unit/mentalHealth.test.js
// SAFETY-CRITICAL: crisis detection, low-mood streaks, EPDS scoring,
// country-specific resource routing.

jest.mock('../../src/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: 'mood-1' }] }),
  pool: { end: jest.fn() },
}));
jest.mock('../../src/services/claude', () => ({
  jsonCall: jest.fn(),
  chat: jest.fn(),
  chatStream: jest.fn(),
}));

const { jsonCall } = require('../../src/services/claude');
const { assessMentalHealth, scoreEPDS, analyzeMoodPattern, isCrisis } =
  require('../../src/services/ai/mentalHealth');
const { getLocale, getEmergencyNumbers } =
  require('../../src/services/ai/localization');

// ── Crisis keyword detection ──────────────────────────────────────────────────

describe('isCrisis — free-text crisis detection', () => {
  const CRISIS_TEXTS = [
    'I have been having suicidal thoughts',
    'sometimes I think about self-harm',
    'I want to hurt myself',
    "I don't want to be here anymore",
    "I don't want to live",
    'I just want to end it all',
    'I wish I was dead',
    'there is no reason to live',
    'my husband has been abusive',
    'I am experiencing domestic violence',
    'he hit me last night',
  ];

  it.each(CRISIS_TEXTS.map((t) => [t]))('"%s" → crisis', (text) => {
    expect(isCrisis(text)).toBe(true);
  });

  const SAFE_TEXTS = [
    'I am tired and a bit weepy today',
    'feeling overwhelmed with the nursery to-do list',
    'anxious about the glucose test',
    'baby kept me up all night, exhausted',
  ];

  it.each(SAFE_TEXTS.map((t) => [t]))('"%s" → not crisis', (text) => {
    expect(isCrisis(text)).toBe(false);
  });
});

describe('assessMentalHealth — crisis intercept', () => {
  it('crisis text returns crisis response WITHOUT calling Claude', async () => {
    const r = await assessMentalHealth({
      userId: 'u1',
      mood: 'sad',
      note: 'I wish I was dead',
    });
    expect(jsonCall).not.toHaveBeenCalled();
    expect(r.crisis).toBe(true);
    expect(r.riskLevel).toBe('crisis');
    expect(r.suggestions.join(' ')).toMatch(/helpline|emergency/i);
  });

  it('crisis in the mood field alone is also caught', async () => {
    const r = await assessMentalHealth({ userId: 'u1', mood: 'suicidal' });
    expect(jsonCall).not.toHaveBeenCalled();
    expect(r.crisis).toBe(true);
  });

  it('normal mood goes through the AI path', async () => {
    jsonCall.mockResolvedValueOnce({
      riskLevel: 'low',
      reflection: 'Thanks for sharing.',
      ppdScreenSuggested: false,
      suggestions: [],
      resourcePrompt: '',
    });
    const r = await assessMentalHealth({ userId: 'u1', mood: 'tired', note: 'long day' });
    expect(jsonCall).toHaveBeenCalledTimes(1);
    expect(r.crisis).toBe(false);
    expect(r.riskLevel).toBe('low');
  });
});

// ── Low-mood streak detection ─────────────────────────────────────────────────

describe('analyzeMoodPattern — consecutive low-mood streaks', () => {
  const lows = (n) => Array.from({ length: n }, () => ({ mood_score: 1 }));
  const highs = (n) => Array.from({ length: n }, () => ({ mood_score: 5 }));

  it('detects a consistently low streak (avg ≤ 2)', () => {
    expect(analyzeMoodPattern(lows(5))).toBe('consistently_low');
  });

  it('detects a consistently positive run', () => {
    expect(analyzeMoodPattern(highs(5))).toBe('consistently_positive');
  });

  it('detects decline (recent low after earlier high)', () => {
    // Latest first: 3 recent low scores, 3 older high scores
    const moods = [
      { mood_score: 2 }, { mood_score: 2 }, { mood_score: 2 },
      { mood_score: 5 }, { mood_score: 5 }, { mood_score: 4 },
    ];
    expect(analyzeMoodPattern(moods)).toBe('declining');
  });

  it('detects improvement', () => {
    const moods = [
      { mood_score: 5 }, { mood_score: 4 }, { mood_score: 5 },
      { mood_score: 2 }, { mood_score: 2 }, { mood_score: 2 },
    ];
    expect(analyzeMoodPattern(moods)).toBe('improving');
  });

  it('needs at least 3 logs', () => {
    expect(analyzeMoodPattern([])).toBeNull();
    expect(analyzeMoodPattern(lows(2))).toBeNull();
    expect(analyzeMoodPattern(null)).toBeNull();
  });
});

// ── EPDS scoring (clinical cut-offs) ─────────────────────────────────────────

describe('scoreEPDS', () => {
  it('scores a maximum-risk survey', () => {
    const r = scoreEPDS([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(r.total).toBe(30);
    expect(r.riskLevel).toBe('high');
    expect(r.highRisk).toBe(true);
    expect(r.flag).toBe(true);
  });

  it('total 13 is the high-risk clinical cut-off', () => {
    const r = scoreEPDS([3, 3, 3, 3, 1, 0, 0, 0, 0, 0]);
    expect(r.total).toBe(13);
    expect(r.highRisk).toBe(true);
  });

  it('total 10-12 flags as elevated but not high', () => {
    const r = scoreEPDS([3, 3, 3, 1, 0, 0, 0, 0, 0, 0]);
    expect(r.total).toBe(10);
    expect(r.riskLevel).toBe('elevated');
    expect(r.flag).toBe(true);
    expect(r.highRisk).toBe(false);
  });

  it('total below 7 is ok', () => {
    const r = scoreEPDS([1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.riskLevel).toBe('ok');
    expect(r.flag).toBe(false);
  });

  it('clamps out-of-range answers to 0-3', () => {
    const r = scoreEPDS([9, -4, 3, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.total).toBe(6); // 3 + 0 + 3
  });

  it('rejects surveys that are not exactly 10 answers', () => {
    expect(() => scoreEPDS([1, 2, 3])).toThrow(/10 answers/);
    expect(() => scoreEPDS('not an array')).toThrow();
  });
});

// ── Country-specific resource routing ─────────────────────────────────────────

describe('country-specific crisis resource routing', () => {
  it.each([
    ['US', '911'],
    ['GB', '999'],
    ['PK', '1122'],
    ['AU', '000'],
    ['IN', '112'],
  ])('%s routes to emergency number %s', (country, number) => {
    const numbers = getEmergencyNumbers(country);
    const all = JSON.stringify(numbers);
    expect(all).toContain(number);
  });

  it('unknown country falls back to a usable default locale', () => {
    const locale = getLocale('ZZ');
    expect(locale).toBeTruthy();
    expect(locale.emergencyNumber).toBeTruthy();
  });

  it('locale lookup is case-insensitive or handles lowercase input', () => {
    const upper = getLocale('GB');
    const lower = getLocale('gb');
    // Either both resolve to GB, or lowercase falls back — must never throw
    expect(upper.emergencyNumber).toBe('999');
    expect(lower).toBeTruthy();
  });
});
