// tests/unit/contractionAnalyzer.test.js
// SAFETY-CRITICAL: 5-1-1 rule detection and go_to_hospital flags.

jest.mock('../../src/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  pool: { end: jest.fn() },
}));
jest.mock('../../src/services/claude', () => ({
  jsonCall: jest.fn(),
  chat: jest.fn(),
  chatStream: jest.fn(),
}));

const { jsonCall } = require('../../src/services/claude');
const { analyzeContractions, evaluate511 } =
  require('../../src/services/ai/contractionAnalyzer');
const {
  CONTRACTIONS_BRAXTON_HICKS,
  CONTRACTIONS_EARLY_LABOUR,
  CONTRACTIONS_ACTIVE_LABOUR,
  buildContractions,
} = require('../fixtures');

describe('evaluate511 — the 5-1-1 rule', () => {
  it('active labour fixture (4 min apart, 70s, >1h) MEETS 5-1-1', () => {
    const r = evaluate511(CONTRACTIONS_ACTIVE_LABOUR, 39);
    expect(r.meets511).toBe(true);
    expect(r.avgIntervalSec).toBeLessThanOrEqual(300);
    expect(r.avgDurationSec).toBeGreaterThanOrEqual(60);
    expect(r.spanMinutes).toBeGreaterThanOrEqual(60);
  });

  it('early labour fixture (10 min apart, 45s) does NOT meet 5-1-1', () => {
    const r = evaluate511(CONTRACTIONS_EARLY_LABOUR, 39);
    expect(r.meets511).toBe(false);
  });

  it('Braxton Hicks fixture (irregular, short) does NOT meet 5-1-1', () => {
    const r = evaluate511(CONTRACTIONS_BRAXTON_HICKS, 32);
    expect(r.meets511).toBe(false);
  });

  it('close interval but short duration fails the "1 minute" leg', () => {
    const events = buildContractions({ count: 15, intervalMin: 4, durationSec: 30 });
    expect(evaluate511(events, 39).meets511).toBe(false);
  });

  it('long duration but wide interval fails the "5 minutes" leg', () => {
    const events = buildContractions({ count: 10, intervalMin: 12, durationSec: 90 });
    expect(evaluate511(events, 39).meets511).toBe(false);
  });

  it('right pattern but only 30 minutes of data fails the "1 hour" leg', () => {
    const events = buildContractions({ count: 8, intervalMin: 4, durationSec: 70 }); // span 28 min
    expect(evaluate511(events, 39).meets511).toBe(false);
  });

  it('fewer than 3 contractions returns no pattern', () => {
    const r = evaluate511(CONTRACTIONS_ACTIVE_LABOUR.slice(0, 2), 39);
    expect(r.meets511).toBe(false);
    expect(r.avgIntervalSec).toBeNull();
  });

  it('preterm alert: regular contractions before week 37', () => {
    const events = buildContractions({ count: 6, intervalMin: 8, durationSec: 40 });
    const r = evaluate511(events, 33);
    expect(r.pretermAlert).toBe(true);
  });

  it('same pattern at week 39 is NOT a preterm alert', () => {
    const events = buildContractions({ count: 6, intervalMin: 8, durationSec: 40 });
    const r = evaluate511(events, 39);
    expect(r.pretermAlert).toBeFalsy();
  });

  it('handles snake_case DB rows (started_at / duration_sec)', () => {
    const events = CONTRACTIONS_ACTIVE_LABOUR.map((e) => ({
      started_at: e.startedAt, ended_at: e.endedAt, duration_sec: e.durationSec,
    }));
    expect(evaluate511(events, 39).meets511).toBe(true);
  });
});

describe('analyzeContractions — go_to_hospital flags', () => {
  it('5-1-1 pattern → goToHospital even when the AI call fails (fail-safe)', async () => {
    jsonCall.mockRejectedValueOnce(new Error('API down'));
    const r = await analyzeContractions({
      userId: 'u1', events: CONTRACTIONS_ACTIVE_LABOUR, gestationalWeek: 39,
    });
    expect(r.meets511).toBe(true);
    expect(r.goToHospital).toBe(true);
    expect(r.callProviderNow).toBe(true);
    expect(r.pattern).toBe('active_labour');
  });

  it('preterm pattern → callProviderNow even when the AI call fails', async () => {
    jsonCall.mockRejectedValueOnce(new Error('API down'));
    const events = buildContractions({ count: 6, intervalMin: 8, durationSec: 40 });
    const r = await analyzeContractions({ userId: 'u1', events, gestationalWeek: 33 });
    expect(r.pretermAlert).toBe(true);
    expect(r.callProviderNow).toBe(true);
  });

  it('Braxton Hicks → no hospital flags', async () => {
    jsonCall.mockResolvedValueOnce({
      pattern: 'irregular',
      assessment: 'Irregular practice contractions.',
      recommendation: 'Rest and hydrate.',
      callProviderNow: false,
      goToHospitalNow: false,
    });
    const r = await analyzeContractions({
      userId: 'u1', events: CONTRACTIONS_BRAXTON_HICKS, gestationalWeek: 32,
    });
    expect(r.goToHospital).toBe(false);
    expect(r.meets511).toBe(false);
  });

  it('local 5-1-1 result overrides a missing AI hospital flag', async () => {
    // AI returns no explicit flags → fall back to local calculation
    jsonCall.mockResolvedValueOnce({ pattern: 'active_labour', assessment: 'x', recommendation: 'y' });
    const r = await analyzeContractions({
      userId: 'u1', events: CONTRACTIONS_ACTIVE_LABOUR, gestationalWeek: 40,
    });
    expect(r.goToHospital).toBe(true);
  });

  it('uses profile.currentWeek when gestationalWeek not given', async () => {
    jsonCall.mockRejectedValueOnce(new Error('API down'));
    const events = buildContractions({ count: 6, intervalMin: 8, durationSec: 40 });
    const r = await analyzeContractions({
      userId: 'u1', events, profile: { currentWeek: 30 },
    });
    expect(r.pretermAlert).toBe(true);
  });
});
