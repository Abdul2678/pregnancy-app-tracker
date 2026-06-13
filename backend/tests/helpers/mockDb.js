// tests/helpers/mockDb.js
// In-memory stand-in for src/db with a stateful users table — enough to
// exercise the auth routes (register, login, lockout, refresh rotation).

const bcrypt = require('bcryptjs');

function createMockDb() {
  const users = new Map(); // email → user row
  let idCounter = 1;

  const query = jest.fn(async (sql, params = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    // Schema migrations and misc DDL: no-op
    if (/^(ALTER|CREATE)/i.test(s)) return { rows: [], rowCount: 0 };

    // INSERT INTO users ... RETURNING
    if (/INSERT INTO users/i.test(s)) {
      const [email, passwordHash, displayName, accountType] = params;
      if (users.has(email)) {
        const err = new Error('duplicate key');
        err.code = '23505';
        throw err;
      }
      const row = {
        id: `user-${idCounter++}`,
        email,
        password_hash: passwordHash,
        display_name: displayName ?? null,
        account_type: accountType ?? 'primary',
        refresh_token_hash: null,
        failed_login_count: 0,
        locked_until: null,
        deleted_at: null,
        deletion_requested_at: null,
        reset_otp_hash: null,
        reset_otp_expires: null,
        reset_otp_attempts: 0,
        auth_provider: 'email',
      };
      users.set(email, row);
      return { rows: [row], rowCount: 1 };
    }

    // SELECT ... FROM users WHERE email = $1
    if (/FROM users WHERE email = \$1/i.test(s)) {
      const row = users.get(params[0]);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }

    // SELECT ... FROM users WHERE id = $1
    if (/FROM users WHERE id = \$1/i.test(s)) {
      const row = [...users.values()].find((u) => u.id === params[0] && !u.deleted_at);
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }

    // UPDATE users SET failed_login_count = $2, locked_until = ...
    if (/UPDATE users SET failed_login_count = \$2/i.test(s)) {
      const row = [...users.values()].find((u) => u.id === params[0]);
      if (row) {
        row.failed_login_count = params[1];
        row.locked_until = /interval/.test(s)
          ? new Date(Date.now() + 15 * 60 * 1000)
          : null;
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    // Successful-login reset: UPDATE users SET failed_login_count = 0, locked_until = NULL
    if (/UPDATE users SET failed_login_count = 0/i.test(s)) {
      const row = [...users.values()].find((u) => u.id === params[0]);
      if (row) { row.failed_login_count = 0; row.locked_until = null; }
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    // Refresh token storage: UPDATE users SET refresh_token_hash = $1 ... WHERE id = $2
    if (/UPDATE users SET refresh_token_hash = \$1/i.test(s)) {
      const row = [...users.values()].find((u) => u.id === params[1]);
      if (row) row.refresh_token_hash = params[0];
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    // Logout: refresh_token_hash = NULL
    if (/UPDATE users SET refresh_token_hash = NULL/i.test(s)) {
      const row = [...users.values()].find((u) => u.id === params[0]);
      if (row) row.refresh_token_hash = null;
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    // Everything else (profiles, logs, conversations…): empty success
    return { rows: [], rowCount: 0 };
  });

  return {
    query,
    pool: { end: jest.fn() },
    _users: users,
    _seedUser: async ({ email, password, ...rest }) => {
      const row = {
        id: `user-${idCounter++}`,
        email,
        password_hash: await bcrypt.hash(password, 4),
        display_name: null,
        account_type: 'primary',
        refresh_token_hash: null,
        failed_login_count: 0,
        locked_until: null,
        deleted_at: null,
        auth_provider: 'email',
        ...rest,
      };
      users.set(email, row);
      return row;
    },
  };
}

module.exports = { createMockDb };
