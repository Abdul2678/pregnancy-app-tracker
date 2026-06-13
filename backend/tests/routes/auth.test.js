// tests/routes/auth.test.js
// Register, login, lockout, refresh rotation, rate limiting — via supertest.

const { createMockDb } = require('../helpers/mockDb');

const mockDb = createMockDb();
jest.mock('../../src/db', () => mockDb);
jest.mock('../../src/services/claude', () => ({
  jsonCall: jest.fn(), chat: jest.fn(), chatStream: jest.fn(),
}));
jest.mock('../../src/lib/claude', () => ({
  jsonCall: jest.fn(), chat: jest.fn(), chatStream: jest.fn(),
  callClaude: jest.fn(), MODEL: 'test', getClient: jest.fn(),
}));

const request = require('supertest');
const { createApp } = require('../../src/app');

const app = createApp();

describe('POST /api/auth/register', () => {
  it('creates an account and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@example.com', password: 'password123', displayName: 'Test',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('new@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com', password: 'password123',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com', password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('rejects passwords under 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short@example.com', password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('rejects malformed emails', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email', password: 'password123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await mockDb._seedUser({ email: 'login@example.com', password: 'correct-horse1' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com', password: 'correct-horse1',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects a wrong password with 401 and a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com', password: 'wrong-password',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects unknown emails with the SAME generic message (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@example.com', password: 'whatever123',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});

describe('Account lockout — 5 failed logins → 15-minute lock', () => {
  beforeAll(async () => {
    await mockDb._seedUser({ email: 'lockme@example.com', password: 'right-password1' });
  });

  it('locks the account after 5 consecutive failures', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({
        email: 'lockme@example.com', password: 'wrong',
      });
      expect(res.status).toBe(401);
    }
    // 6th attempt — even with the CORRECT password — is locked out
    const res = await request(app).post('/api/auth/login').send({
      email: 'lockme@example.com', password: 'right-password1',
    });
    expect(res.status).toBe(423);
    expect(res.body.error).toMatch(/locked/i);
  });
});

describe('POST /api/auth/refresh — rotation', () => {
  let refreshToken;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'rotate@example.com', password: 'password123',
    });
    refreshToken = res.body.data.refreshToken;
  });

  it('exchanges a valid refresh token for new tokens', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    // Rotation: keep the new token for the next test
    refreshToken = res.body.data.refreshToken;
  });

  it('rejects garbage refresh tokens', async () => {
    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'garbage.token.value',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a refresh token after logout revokes it', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'rotate@example.com', password: 'password123',
    });
    const { accessToken, refreshToken: rt } = login.body.data;

    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: rt });
    expect(res.status).toBe(401);
  });
});

describe('Auth rate limiting', () => {
  it('returns 429 after exceeding the auth limiter window', async () => {
    // The shared app instance has accumulated auth calls above; hammer until 429.
    let got429 = false;
    for (let i = 0; i < 25 && !got429; i++) {
      const res = await request(app).post('/api/auth/login').send({
        email: `flood${i}@example.com`, password: 'xxxxxxxxx',
      });
      if (res.status === 429) got429 = true;
    }
    expect(got429).toBe(true);
  });
});

describe('Protected endpoints', () => {
  it('GET /api/auth/me without a token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me with a forged token → 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer forged.jwt.token');
    expect(res.status).toBe(401);
  });
});
