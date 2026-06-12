// server.js
// Entry point: boots the HTTP server, schedules cron jobs, handles graceful shutdown.

require('dotenv').config();

const { createApp } = require('./app');
const { pool } = require('./db');
const { scheduleSymptomPatternJob } = require('./jobs/symptomPatternJob');
const { scheduleNotificationJobs } = require('./jobs/notificationJob');

const PORT = process.env.PORT || 4000;

const app = createApp();
const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Bloom API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// Background cron jobs
let cronTask = null;
let notifTask = null;
if (process.env.ENABLE_CRON !== 'false') {
  cronTask = scheduleSymptomPatternJob();
  notifTask = scheduleNotificationJobs();
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[server] ${signal} received — shutting down gracefully…`);

  if (cronTask && typeof cronTask.stop === 'function') cronTask.stop();
  if (notifTask && typeof notifTask.stop === 'function') notifTask.stop();

  server.close(async () => {
    try {
      await pool.end();
      // eslint-disable-next-line no-console
      console.log('[server] closed cleanly');
      process.exit(0);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[server] error during shutdown', err);
      process.exit(1);
    }
  });

  // Force-exit if it takes too long
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[server] forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { server };
