// routes/health.js
// GET /api/health — liveness + readiness probe.

'use strict';

const { Router } = require('express');
const { pool }   = require('../../db');
const config     = require('../../config');
const { version } = require('../../../package.json');

const router = Router();

const started = Date.now();

router.get('/', async (req, res) => {
  const uptime = Math.floor((Date.now() - started) / 1000);

  // Probe DB (fast timeout so health check never hangs)
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (_) {
    // db offline — still respond so the load balancer doesn't kill us
  }

  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  res.status(httpStatus).json({
    status,
    version,
    env: config.env,
    uptime,             // seconds since server start
    db: dbOk ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
