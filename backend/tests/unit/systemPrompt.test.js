// tests/unit/systemPrompt.test.js
// buildSystemPrompt must always include safety rules and reflect every
// profile combination correctly.

const { buildSystemPrompt, deriveTrimester, SAFETY_RULES } =
  require('../../src/services/ai/systemPrompt');
const { PROFILE_WEEK_8, PROFILE_WEEK_24, PROFILE_WEEK_38 } = require('../fixtures');

describe('deriveTrimester', () => {
  it.each([
    [1, 'first'], [8, 'first'], [13, 'first'],
    [14, 'second'], [24, 'second'], [26, 'second'],
    [27, 'third'], [38, 'third'], [42, 'third'],
  ])('week %i → %s trimester', (week, expected) => {
    expect(deriveTrimester(week)).toBe(expected);
  });

  it('returns null for missing week', () => {
    expect(deriveTrimester(null)).toBeNull();
    expect(deriveTrimester(undefined)).toBeNull();
    expect(deriveTrimester(0)).toBeNull();
  });
});

describe('buildSystemPrompt — safety invariants', () => {
  const allProfiles = [
    {}, PROFILE_WEEK_8, PROFILE_WEEK_24, PROFILE_WEEK_38,
  ];

  it.each(allProfiles.map((p, i) => [i, p]))(
    'profile #%i ALWAYS includes the safety rules',
    (_, user) => {
      const prompt = buildSystemPrompt({ user });
      expect(prompt).toContain('SAFETY RULES');
      expect(prompt).toContain('NOT a doctor');
      expect(prompt).toContain('Heavy vaginal bleeding');
      expect(prompt).toContain('No fetal movement');
      expect(prompt).toContain('preterm labour');
    }
  );

  it('all three modes include safety rules', () => {
    for (const mode of ['chat', 'partner', 'postpartum']) {
      expect(buildSystemPrompt({ mode })).toContain(SAFETY_RULES);
    }
  });
});

describe('buildSystemPrompt — profile combinations', () => {
  it('first-trimester user (week 8, Pakistan, Urdu)', () => {
    const prompt = buildSystemPrompt({
      user: PROFILE_WEEK_8,
      pregnancy: { current_week: 8 },
    });
    expect(prompt).toContain('Current pregnancy week: 8');
    expect(prompt).toContain('Trimester: first');
    expect(prompt).toContain("User's name: Amina");
    expect(prompt).toContain('located in: PK');
  });

  it('second-trimester user (week 24)', () => {
    const prompt = buildSystemPrompt({
      user: PROFILE_WEEK_24,
      pregnancy: { current_week: 24 },
    });
    expect(prompt).toContain('Current pregnancy week: 24');
    expect(prompt).toContain('Trimester: second');
  });

  it('high-risk third-trimester user gets the high-risk caution', () => {
    const prompt = buildSystemPrompt({
      user: PROFILE_WEEK_38,
      pregnancy: { current_week: 38, high_risk_flag: true },
    });
    expect(prompt).toContain('Trimester: third');
    expect(prompt).toContain('HIGH-RISK');
  });

  it('multiples and IVF flags are reflected', () => {
    const prompt = buildSystemPrompt({
      pregnancy: { current_week: 20, is_multiples: true, is_ivf: true },
    });
    expect(prompt).toContain('Multiple pregnancy');
    expect(prompt).toContain('IVF conception');
  });

  it('non-English language adds a respond-in-language instruction', () => {
    const prompt = buildSystemPrompt({ user: {}, language: 'ur' });
    expect(prompt).toContain('Respond in language: ur');
  });

  it('English language adds no language instruction', () => {
    const prompt = buildSystemPrompt({ user: {}, language: 'en' });
    expect(prompt).not.toContain('Respond in language');
  });

  it('partner mode speaks to the partner', () => {
    const prompt = buildSystemPrompt({ mode: 'partner' });
    expect(prompt).toContain('PARTNER of a pregnant person');
    expect(prompt).toContain('how the partner can provide support');
  });

  it('postpartum mode focuses on recovery and PPD', () => {
    const prompt = buildSystemPrompt({ mode: 'postpartum' });
    expect(prompt).toContain('postpartum AI companion');
    expect(prompt).toContain('PPD/PPA');
  });

  it('empty profile produces a valid prompt without context noise', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toContain('Current pregnancy week');
    expect(prompt).not.toContain("User's name");
    expect(prompt).not.toContain('located in');
    expect(prompt.length).toBeGreaterThan(200);
  });

  it('trimester is derived from week when not explicitly set', () => {
    const prompt = buildSystemPrompt({ pregnancy: { current_week: 10 } });
    expect(prompt).toContain('Trimester: first');
  });
});
