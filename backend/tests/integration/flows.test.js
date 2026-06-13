// tests/integration/flows.test.js
// Full API flows via supertest: onboarding, chat turn, emergency intercept.
// Claude is mocked at the lib boundary; the DB is mocked in-memory.
// The emergency-intercept test asserts the Claude mock is NEVER called.

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('../../src/db', () => ({
  query: (...args) => mockQuery(...args),
  pool: { end: jest.fn() },
}));

const mockChat = jest.fn();
const mockJsonCall = jest.fn();
jest.mock('../../src/lib/claude', () => ({
  chat: (...a) => mockChat(...a),
  jsonCall: (...a) => mockJsonCall(...a),
  chatStream: jest.fn(),
  callClaude: jest.fn(),
  MODEL: 'test',
  getClient: jest.fn(),
}));
jest.mock('../../src/services/claude', () => ({
  chat: (...a) => mockChat(...a),
  jsonCall: (...a) => mockJsonCall(...a),
  chatStream: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');

const app = createApp();
const token = jwt.sign(
  { sub: 'user-int', email: 'int@test.com', accountType: 'primary' },
  process.env.JWT_SECRET
);
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  mockQuery.mockResolvedValue({ rows: [] });
});

// ── Onboarding flow ───────────────────────────────────────────────────────────

describe('POST /api/onboarding — full flow', () => {
  it('returns a valid personalised profile', async () => {
    // The onboarding service asks Claude for personalisation JSON
    mockJsonCall.mockResolvedValue({
      dueDate: '2026-12-20',
      currentWeek: 13,
      trimester: 1,
      contentTrack: 'standard',
      featurePriorities: ['track_symptoms', 'learn'],
      firstTipCategory: 'nutrition',
      onboardingMessage: 'Welcome! Week 13 is an exciting time.',
      suggestedFirstAction: 'Log how you feel today',
      notifyDoctor: false,
    });
    // upsertProfile INSERT ... RETURNING
    mockQuery.mockImplementation(async (sql) =>
      /RETURNING/i.test(sql)
        ? { rows: [{ user_id: 'user-int', current_week: 13, content_track: 'standard' }] }
        : { rows: [] }
    );

    const res = await auth(request(app).post('/api/onboarding')).send({
      dateInput: '2026-03-15',
      dateType: 'lmp',
      isFirst: true,
      age: 29,
      country: 'GB',
      language: 'en',
      goals: ['track_symptoms'],
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile).toBeTruthy();
    expect(res.body.data.onboardingMessage).toMatch(/welcome/i);
    expect(mockJsonCall).toHaveBeenCalled();
  });

  it('rejects an invalid dateType', async () => {
    const res = await auth(request(app).post('/api/onboarding')).send({
      dateInput: '2026-03-15', dateType: 'banana',
    });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/onboarding').send({
      dateInput: '2026-03-15', dateType: 'lmp',
    });
    expect(res.status).toBe(401);
  });
});

// ── Chat turn ─────────────────────────────────────────────────────────────────

describe('POST /api/ai/chat — full turn', () => {
  function mockConversationDb() {
    mockQuery.mockImplementation(async (sql) => {
      if (/INSERT INTO conversations/i.test(sql)) {
        return { rows: [{ id: 'conv-1', mode: 'standard' }] };
      }
      if (/SELECT role, content FROM messages/i.test(sql)) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  }

  it('returns the assistant reply for a normal message', async () => {
    mockConversationDb();
    mockChat.mockResolvedValue('Mild nausea is very common in week 8. Try small, frequent meals.');

    const res = await auth(request(app).post('/api/ai/chat')).send({
      message: 'Is nausea normal at week 8?',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toMatch(/nausea/i);
    expect(res.body.data.emergency).toBe(false);
    expect(res.body.data.conversationId).toBe('conv-1');
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('persists both the user and assistant turns', async () => {
    mockConversationDb();
    mockChat.mockResolvedValue('Reply text');

    await auth(request(app).post('/api/ai/chat')).send({ message: 'hello there' });

    const inserts = mockQuery.mock.calls.filter(([sql]) => /INSERT INTO messages/i.test(sql));
    expect(inserts.length).toBe(2);
  });

  it('rejects an empty message', async () => {
    const res = await auth(request(app).post('/api/ai/chat')).send({ message: '' });
    expect(res.status).toBe(400);
  });
});

// ── Emergency intercept — the critical one ────────────────────────────────────

describe('POST /api/ai/chat — emergency intercept', () => {
  const EMERGENCY_MESSAGES = [
    'My baby is not moving since last night',
    'I am bleeding heavily, soaking through pads',
    'I have chest pain and I feel faint',
    "I can't breathe properly",
    'I think my water broke and I am only 34 weeks',
    'I just had a seizure',
  ];

  it.each(EMERGENCY_MESSAGES.map((m) => [m]))(
    '"%s" → emergency response WITHOUT calling Claude',
    async (message) => {
      mockQuery.mockImplementation(async (sql) => {
        if (/INSERT INTO conversations/i.test(sql)) return { rows: [{ id: 'conv-e' }] };
        return { rows: [] };
      });

      const res = await auth(request(app).post('/api/ai/chat')).send({ message });

      expect(res.status).toBe(200);
      expect(res.body.data.emergency).toBe(true);
      expect(res.body.data.reply).toMatch(/emergency|911|999|112|hospital/i);

      // THE invariant: a life-threatening message must never wait on an LLM
      expect(mockChat).not.toHaveBeenCalled();
      expect(mockJsonCall).not.toHaveBeenCalled();
    }
  );

  it('emergency assistant turn is persisted with is_emergency = true', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (/INSERT INTO conversations/i.test(sql)) return { rows: [{ id: 'conv-e2' }] };
      return { rows: [] };
    });

    await auth(request(app).post('/api/ai/chat')).send({
      message: 'bleeding heavily right now',
    });

    const assistantInsert = mockQuery.mock.calls.find(
      ([sql]) => /INSERT INTO messages/i.test(sql) && /is_emergency/i.test(sql)
    );
    expect(assistantInsert).toBeTruthy();
    expect(assistantInsert[1]).toContain(true); // is_emergency param
  });
});
