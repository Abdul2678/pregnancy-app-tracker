// tests/unit/symptomTriage.test.js
// SAFETY-CRITICAL: the emergency intercept must fire for every urgent
// phrasing and must NEVER call the Claude API.

jest.mock('../../src/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: 'log-1' }] }),
  pool: { end: jest.fn() },
}));
jest.mock('../../src/services/claude', () => ({
  jsonCall: jest.fn(),
  chat: jest.fn(),
  chatStream: jest.fn(),
}));

const db = require('../../src/db');
const { jsonCall } = require('../../src/services/claude');
const { triageSymptom, isEmergency, EMERGENCY_RESPONSE } =
  require('../../src/services/ai/symptomTriage');
const { SYMPTOMS_URGENT, SYMPTOMS_NORMAL, PROFILE_WEEK_24 } = require('../fixtures');

describe('isEmergency — every urgent phrasing triggers', () => {
  it.each(SYMPTOMS_URGENT.map((s) => [s]))('"%s" → emergency', (text) => {
    expect(isEmergency(text)).toBe(true);
  });

  it.each(SYMPTOMS_NORMAL.map((s) => [s.symptomText]))(
    '"%s" → NOT emergency',
    (text) => {
      expect(isEmergency(text)).toBe(false);
    }
  );

  it('is case-insensitive', () => {
    expect(isEmergency('HEAVY BLEEDING')).toBe(true);
    expect(isEmergency('Chest Pain')).toBe(true);
  });
});

describe('triageSymptom — emergency intercept', () => {
  it.each(SYMPTOMS_URGENT.map((s) => [s]))(
    'urgent symptom "%s" returns emergency response WITHOUT calling Claude',
    async (symptomText) => {
      const result = await triageSymptom({
        userId: 'u1', symptomText, profile: PROFILE_WEEK_24,
      });

      // The whole point: API must never be touched on an emergency
      expect(jsonCall).not.toHaveBeenCalled();

      expect(result.severity).toBe('emergency');
      expect(result.goToHospital).toBe(true);
      expect(result.callProviderNow).toBe(true);
      expect(result.intercepted).toBe(true);
      expect(result.actionSteps.join(' ')).toMatch(/emergency number|hospital/i);
    }
  );

  it('emergency result is still persisted to symptom_logs', async () => {
    await triageSymptom({ userId: 'u1', symptomText: 'heavy bleeding' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO symptom_logs'),
      expect.arrayContaining(['u1'])
    );
  });

  it('emergency response never tells the user to wait', () => {
    const text = JSON.stringify(EMERGENCY_RESPONSE).toLowerCase();
    expect(text).not.toContain('wait and see');
    expect(EMERGENCY_RESPONSE.whenToEscalate).toMatch(/now/i);
  });
});

describe('triageSymptom — AI classification mapping', () => {
  const aiCase = (severity) => {
    jsonCall.mockResolvedValueOnce({
      severity,
      explanation: 'test explanation',
      actionSteps: ['step 1'],
      whenToEscalate: 'if worse',
      reassurance: 'this is common',
    });
  };

  it('NORMAL maps to self_care, no hospital flags', async () => {
    aiCase('NORMAL');
    const r = await triageSymptom({ userId: 'u1', symptomText: 'mild nausea' });
    expect(jsonCall).toHaveBeenCalledTimes(1);
    expect(r.severity).toBe('self_care');
    expect(r.goToHospital).toBe(false);
    expect(r.callProviderNow).toBe(false);
    expect(r.intercepted).toBe(false);
  });

  it('MONITOR maps to monitor', async () => {
    aiCase('MONITOR');
    const r = await triageSymptom({ userId: 'u1', symptomText: 'occasional dizziness' });
    expect(r.severity).toBe('monitor');
    expect(r.goToHospital).toBe(false);
  });

  it('CALL_DOCTOR maps to call_provider', async () => {
    aiCase('CALL_DOCTOR');
    const r = await triageSymptom({ userId: 'u1', symptomText: 'persistent headache' });
    expect(r.severity).toBe('call_provider');
    expect(r.goToHospital).toBe(false);
  });

  it('URGENT from AI sets callProviderNow', async () => {
    aiCase('URGENT');
    const r = await triageSymptom({ userId: 'u1', symptomText: 'reduced appetite and dizzy spells' });
    expect(r.severity).toBe('urgent');
    expect(r.callProviderNow).toBe(true);
  });

  it('AI-declared emergency sets goToHospital', async () => {
    aiCase('EMERGENCY');
    const r = await triageSymptom({ userId: 'u1', symptomText: 'strange swelling everywhere' });
    expect(r.severity).toBe('emergency');
    expect(r.goToHospital).toBe(true);
    expect(r.callProviderNow).toBe(true);
  });

  it('unknown severity from AI defaults to monitor (never silently self_care)', async () => {
    aiCase('SOMETHING_WEIRD');
    const r = await triageSymptom({ userId: 'u1', symptomText: 'odd tingling' });
    expect(r.severity).toBe('monitor');
  });

  it('AI failure falls back to monitor with provider advice (fail-safe)', async () => {
    jsonCall.mockRejectedValueOnce(new Error('API down'));
    const r = await triageSymptom({ userId: 'u1', symptomText: 'mild cramping' });
    expect(r.severity).toBe('monitor');
    expect(r.explanation).toMatch(/healthcare provider/i);
  });

  it('DB failure never blocks the triage response', async () => {
    aiCase('MONITOR');
    db.query.mockRejectedValueOnce(new Error('DB down'));
    const r = await triageSymptom({ userId: 'u1', symptomText: 'tired all day' });
    expect(r.severity).toBe('monitor');
    expect(r.logId).toBeNull();
  });
});
