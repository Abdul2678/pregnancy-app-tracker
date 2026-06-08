// middleware/rateLimit.js
// Rate limiters — all keyed by user ID when authenticated, IP otherwise.

const rateLimit = require('express-rate-limit');

const base = {
  standardHeaders: true,
  legacyHeaders:   false,
  // Use authenticated user ID as the key when available; fall back to IP.
  keyGenerator: (req) => req.user?.id || req.ip,
};

function makeMessage(msg) {
  return { success: false, error: msg };
}

// Tight limiter for auth endpoints (brute-force protection, keyed by IP only)
const authLimiter = rateLimit({
  ...base,
  keyGenerator: (req) => req.ip,
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  message: makeMessage('Too many auth attempts — please try again later.'),
});

// AI endpoints: 20 req/min per user (Claude calls are expensive)
const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,        // 1 min
  max: 20,
  message: makeMessage('You are sending AI requests too quickly. Please slow down.'),
});

// General API: 120 req/min per user
const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 120,
  message: makeMessage('Rate limit exceeded. Please slow down.'),
});

// Partner invite endpoints: prevent spam invites
const inviteLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,
  message: makeMessage('Too many invite requests. Please try again later.'),
});

module.exports = { authLimiter, aiLimiter, apiLimiter, inviteLimiter };
