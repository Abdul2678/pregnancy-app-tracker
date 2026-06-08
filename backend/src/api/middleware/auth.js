// middleware/auth.js
// JWT authentication middleware and token helpers.

const jwt = require('jsonwebtoken');
const { fail } = require('./respond');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Require a valid Bearer token. Sets req.user = { id, email, accountType }. */
function authRequired(req, res, next) {
  const token = extractBearer(req);
  if (!token) return fail(res, 'Missing or malformed Authorization header', 401);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:          payload.sub,
      email:       payload.email,
      accountType: payload.accountType || 'primary',
    };
    return next();
  } catch {
    return fail(res, 'Invalid or expired access token', 401);
  }
}

/** Same as authRequired but does not reject — attaches user if token present. */
function optionalAuth(req, res, next) {
  const token = extractBearer(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id:          payload.sub,
        email:       payload.email,
        accountType: payload.accountType || 'primary',
      };
    } catch {
      // ignore invalid tokens in optional mode
    }
  }
  return next();
}

/** Guard a route to admin accounts only. Must be used after authRequired. */
function adminOnly(req, res, next) {
  if (req.user?.accountType !== 'admin') {
    return fail(res, 'Admin access required', 403);
  }
  return next();
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function signAccessToken(user) {
  return jwt.sign(
    {
      sub:         user.id,
      email:       user.email,
      accountType: user.account_type || user.accountType || 'primary',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

module.exports = {
  authRequired,
  optionalAuth,
  adminOnly,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
};
