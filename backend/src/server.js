// server.js
// Entry point: validates config, boots HTTP server, schedules jobs, handles graceful shutdown.

'use strict';

require('dotenv').config();

// Config must load first — it fails fast if required vars are missing
const config = require('./config');

const { createApp }              = require('./app');
const { pool }                   = require('./db');
const { scheduleSymptomPatternJob } = require('./jobs/symptomPatternJob');
const { scheduleNotificationJobs }  = require('./jobs/notificationJob');
const { scheduleDataWipeJob }       = require('./jobs/dataWipeJob');
const { scheduleBackupJob }         = require('./jobs/backupJob');

const app    = createApp();
const server = app.listen(config.server.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Bloom API listening on port ${config.server.port} (${config.env})`);
});

// ── Background cron jobs ──────────────────────────────────────────────────────
const jobs = [];
if (config.cron.enabled) {
  jobs.push(scheduleSymptomPatternJob());
  jobs.push(scheduleNotificationJobs());
  jobs.push(scheduleDataWipeJob());
  jobs.push(scheduleBackupJob());
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[server] ${signal} received — shutting down gracefully…`);

  // Stop cron jobs so no new work starts
  for (const job of jobs) {
    if (job && typeof job.stop === 'function') job.stop();
  }

  // Stop accepting new connections; wait for in-flight requests to finish
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

  // Force-exit after 10 s so Railway/K8s doesn't have to SIGKILL
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[server] forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled promise rejections — log and exit so the process manager restarts
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[server] unhandledRejection', reason);
  if (config.isProd) process.exit(1);
});

module.exports = { server };
