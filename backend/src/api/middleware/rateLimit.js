// api/middleware/rateLimit.js
// Rate limiters per route type.

const rateLimit = require('express-rate-limit');

const standard = {
  standardHeaders: true,
  legacyHeaders: false,
};

// Tight limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Limiter for expensive AI endpoints (chat, triage, features)
const aiLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000, // 1 min
  max: 20,
  message: { error: 'You are sending requests too quickly. Please slow down.' },
});

// General API limiter
const apiLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Rate limit exceeded.' },
});

module.exports = { authLimiter, aiLimiter, apiLimiter };
