// db/migrate.js
// Runs all SQL migration files in src/db/migrations in lexical order.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[migrate] applying ${file}`);
    await pool.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log('[migrate] done');
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[migrate] failed', err);
    pool.end();
    process.exit(1);
  });
