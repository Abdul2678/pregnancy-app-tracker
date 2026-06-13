// tests/routes/tracking.test.js
// CRUD coverage for every log type: symptoms, mood, weight, kicks, contractions.

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('../../src/db', () => ({
  query: (...args) => mockQuery(...args),
  pool: { end: jest.fn() },
}));
const queryMock = mockQuery;
jest.mock('../../src/lib/claude', () => ({
  jsonCall: jest.fn().mockResolvedValue({}),
  chat: jest.fn(), chatStream: jest.fn(), callClaude: jest.fn(),
  MODEL: 'test', getClient: jest.fn(),
}));
jest.mock('../../src/services/claude', () => ({
  jsonCall: jest.fn().mockResolvedValue({}),
  chat: jest.fn(), chatStream: jest.fn(),
}));
jest.mock('../../src/services/symptomTriage', () => ({
  triageSymptom: jest.fn().mockResolvedValue({
    id: 'symptom-1',
    triage_result: { severity: 'monitor', selfCareTips: ['Rest and hydrate.'] },
  }),
}));
jest.mock('../../src/services/profiles', () => ({
  getProfile: jest.fn().mockResolvedValue({ currentWeek: 24, country: 'GB' }),
  rowToProfile: jest.fn((r) => r),
  upsertProfile: jest.fn(),
}));
jest.mock('../../src/services/notify', () => ({
  enqueue: jest.fn().mockResolvedValue(null),
  sendNow: jest.fn().mockResolvedValue(null),
  dispatchDue: jest.fn().mockResolvedValue({ sent: 0 }),
  localTime: jest.fn(() => ({ hour: 12, weekday: 3 })),
  inQuietHours: jest.fn(() => false),
  DEFAULT_NOTIF_SETTINGS: {},
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const { triageSymptom } = require('../../src/services/symptomTriage');

const app = createApp();
const token = jwt.sign(
  { sub: 'user-1', email: 't@e.com', accountType: 'primary' },
  process.env.JWT_SECRET
);
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  // Default DB behaviour: INSERT/UPDATE RETURNING gives a row; SELECT gives []
  queryMock.mockImplementation(async (sql) => {
    if (/RETURNING/i.test(sql)) {
      return { rows: [{ id: 'row-1', kick_times: [], target_kicks: 10, kick_count: 0 }] };
    }
    return { rows: [] };
  });
});

describe('Symptoms', () => {
  it('POST /api/tracking/symptoms triages and returns 201', async () => {
    const res = await auth(request(app).post('/api/tracking/symptoms')).send({
      symptomName: 'headache', severity: 2, durationHours: 3,
    });
    expect(res.status).toBe(201);
    expect(triageSymptom).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', symptomName: 'headache',
    }));
    expect(res.body.data.triage.severity).toBe('monitor');
  });

  it('rejects severity outside 1-5', async () => {
    const res = await auth(request(app).post('/api/tracking/symptoms')).send({
      symptomName: 'headache', severity: 9,
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/tracking/symptoms lists logs', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 's1', symptom_name: 'nausea' }] });
    const res = await auth(request(app).get('/api/tracking/symptoms'));
    expect(res.status).toBe(200);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/tracking/symptoms');
    expect(res.status).toBe(401);
  });
});

describe('Mood', () => {
  it('POST /api/tracking/mood stores a check-in', async () => {
    const res = await auth(request(app).post('/api/tracking/mood')).send({
      mood: 'anxious', moodScore: 3, emotions: ['worried'], note: 'big scan tomorrow',
    });
    expect([200, 201]).toContain(res.status);
  });

  it('rejects an empty mood', async () => {
    const res = await auth(request(app).post('/api/tracking/mood')).send({ mood: '' });
    expect(res.status).toBe(400);
  });

  it('GET /api/tracking/mood/history returns history', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const res = await auth(request(app).get('/api/tracking/mood/history'));
    expect(res.status).toBe(200);
  });
});

describe('Weight', () => {
  it('POST /api/tracking/weight stores a weight log', async () => {
    const res = await auth(request(app).post('/api/tracking/weight')).send({
      weightKg: 68.5,
    });
    expect([200, 201]).toContain(res.status);
  });

  it('rejects non-positive weight', async () => {
    const res = await auth(request(app).post('/api/tracking/weight')).send({
      weightKg: -2,
    });
    expect(res.status).toBe(400);
  });
});

describe('Kick counter', () => {
  it('POST /api/tracking/kicks/sessions starts a session', async () => {
    const res = await auth(request(app).post('/api/tracking/kicks/sessions')).send({
      targetKicks: 10,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.session).toBeTruthy();
  });

  it('PUT /api/tracking/kicks/sessions/:id adds kicks and flags target met', async () => {
    // Existing session with 9 kicks, target 10
    const nine = Array.from({ length: 9 }, (_, i) => `2026-06-12T10:0${i}:00Z`);
    queryMock.mockImplementation(async (sql) => {
      if (/SELECT \* FROM kick_counter_sessions/.test(sql)) {
        return { rows: [{ id: 'k1', kick_times: nine, target_kicks: 10, target_met: false, target_met_at: null }] };
      }
      if (/UPDATE kick_counter_sessions/.test(sql)) {
        return { rows: [{ id: 'k1', kick_count: 10, target_met: true }] };
      }
      return { rows: [] };
    });

    const res = await auth(request(app).put('/api/tracking/kicks/sessions/k1')).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.targetJustMet).toBe(true);
  });

  it('404s for an unknown session', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const res = await auth(request(app).put('/api/tracking/kicks/sessions/nope')).send({});
    expect(res.status).toBe(404);
  });
});

describe('Contractions', () => {
  it('POST /api/tracking/contractions/sessions starts a session', async () => {
    const res = await auth(request(app).post('/api/tracking/contractions/sessions')).send({});
    expect(res.status).toBe(201);
  });

  it('POST events validates ISO datetimes', async () => {
    const res = await auth(
      request(app).post('/api/tracking/contractions/sessions/c1/events')
    ).send({ startTime: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('PUT /close closes the session', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 'c1', is_active: false }] });
    const res = await auth(request(app).put('/api/tracking/contractions/sessions/c1/close'));
    expect(res.status).toBe(200);
  });
});
