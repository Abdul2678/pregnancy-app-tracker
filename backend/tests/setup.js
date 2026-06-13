// tests/setup.js — environment for all tests. No real DB, no real Claude API.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.ANTHROPIC_API_KEY = 'test-key-never-used';
process.env.ENABLE_CRON = 'false';
