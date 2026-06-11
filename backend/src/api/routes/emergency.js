// routes/emergency.js
// GET /api/emergency/:country  — return emergency resources for a country

const express  = require('express');
const db       = require('../../db');
const { ok }   = require('../middleware/respond');
const { apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// GET /:country?lang=en
router.get('/:country', apiLimiter, async (req, res, next) => {
  try {
    const country  = (req.params.country || '').toUpperCase().trim();
    const language = (req.query.lang || 'en').toLowerCase().split('-')[0];

    // Try exact language match first, then fall back to 'en'
    const { rows } = await db.query(
      `SELECT * FROM emergency_resources
       WHERE country = $1
       ORDER BY CASE WHEN language = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [country, language]
    );

    if (!rows.length) {
      return ok(res, {
        country,
        emergency_number:    '112',
        ambulance_number:    null,
        mental_health_line:  null,
        resources:           [],
        note:                'Contact your local emergency services.',
      });
    }

    return ok(res, {
      country:             rows[0].country,
      emergency_number:    rows[0].emergency_number,
      ambulance_number:    rows[0].ambulance_number,
      mental_health_line:  rows[0].mental_health_line,
      resources:           rows[0].resources,
      last_verified_at:    rows[0].last_verified_at,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
