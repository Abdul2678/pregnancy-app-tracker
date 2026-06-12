// jobs/dataWipeJob.js
// GDPR deletion: hard-deletes accounts whose deletion was requested 48+ hours
// ago. Runs hourly. Every user table references users(id) ON DELETE CASCADE,
// so a single DELETE wipes everything.

const cron = require('node-cron');
const db = require('../db');

async function wipeExpiredAccounts() {
  const { rows } = await db.query(
    `SELECT id, email FROM users
     WHERE deletion_requested_at IS NOT NULL
       AND deletion_requested_at < now() - interval '48 hours'`
  );

  for (const u of rows) {
    try {
      await db.query('DELETE FROM users WHERE id = $1', [u.id]);
      console.log(`[dataWipe] permanently erased account ${u.id}`);
    } catch (err) {
      console.error(`[dataWipe] failed to erase ${u.id}`, err.message);
    }
  }
  return rows.length;
}

function scheduleDataWipeJob() {
  const task = cron.schedule('30 * * * *', async () => {
    try {
      const n = await wipeExpiredAccounts();
      if (n) console.log(`[dataWipe] erased ${n} account(s)`);
    } catch (err) {
      console.error('[dataWipe] job error', err.message);
    }
  });
  console.log('[dataWipe] scheduled (hourly)');
  return task;
}

module.exports = { scheduleDataWipeJob, wipeExpiredAccounts };
