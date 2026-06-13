// routes/subscription.js
// Subscription management: status, receipt validation, restore.
// Receipt validation is stubbed — integrate with Apple/Google server-to-server APIs.

const express = require('express');
const router  = express.Router();
const { authRequired } = require('../middleware/auth');
const db = require('../../db');

// Auto-migration on boot
async function ensureSubscriptionsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id     UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tier        VARCHAR(20)  NOT NULL DEFAULT 'free',
      period      VARCHAR(20),
      expires_at  TIMESTAMPTZ,
      receipt_ios TEXT,
      receipt_android TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureSubscriptionsTable().catch(console.error);

// ── GET /subscription/status ──────────────────────────────────────────────────
router.get('/status', authRequired, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT tier, period, expires_at FROM user_subscriptions WHERE user_id = $1',
      [req.user.id]
    );

    if (!rows.length) {
      return res.json({ tier: 'free', period: null, expires_at: null });
    }

    const sub = rows[0];
    // Treat expired subscriptions as free
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      await db.query(
        "UPDATE user_subscriptions SET tier = 'free', period = NULL WHERE user_id = $1",
        [req.user.id]
      );
      return res.json({ tier: 'free', period: null, expires_at: null });
    }

    res.json({ tier: sub.tier, period: sub.period, expires_at: sub.expires_at });
  } catch (err) {
    console.error('subscription status error', err);
    res.status(500).json({ error: 'Failed to load subscription' });
  }
});

// ── POST /subscription/validate ───────────────────────────────────────────────
router.post('/validate', authRequired, async (req, res) => {
  const { receipt, platform, productId } = req.body;
  if (!receipt || !platform || !productId) {
    return res.status(400).json({ error: 'receipt, platform, productId required' });
  }

  try {
    // TODO: Replace stub with real server-to-server validation:
    // iOS:     POST https://buy.itunes.apple.com/verifyReceipt (production)
    //          POST https://sandbox.itunes.apple.com/verifyReceipt (sandbox)
    // Android: Google Play Developer API — purchases.subscriptions.get
    const validationResult = await validateReceipt(receipt, platform, productId);

    const period    = productId.includes('annual') ? 'annual' : 'monthly';
    const expiresAt = validationResult.expiresAt;

    await db.query(
      `INSERT INTO user_subscriptions (user_id, tier, period, expires_at, receipt_ios, receipt_android, updated_at)
       VALUES ($1, 'premium', $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET tier = 'premium', period = $2, expires_at = $3,
             receipt_ios = COALESCE($4, user_subscriptions.receipt_ios),
             receipt_android = COALESCE($5, user_subscriptions.receipt_android),
             updated_at = NOW()`,
      [
        req.user.id,
        period,
        expiresAt,
        platform === 'ios'     ? receipt : null,
        platform === 'android' ? receipt : null,
      ]
    );

    res.json({ tier: 'premium', period, expires_at: expiresAt });
  } catch (err) {
    console.error('receipt validation error', err);
    res.status(400).json({ error: err.message ?? 'Receipt validation failed' });
  }
});

// ── POST /subscription/restore ────────────────────────────────────────────────
router.post('/restore', authRequired, async (req, res) => {
  const { receipt, platform } = req.body;
  if (!receipt || !platform) {
    return res.status(400).json({ error: 'receipt and platform required' });
  }

  try {
    // Use same validation logic as /validate
    const productId = platform === 'ios' ? 'bloom_premium_monthly' : 'bloom_premium_monthly_android';
    const validationResult = await validateReceipt(receipt, platform, productId);

    if (!validationResult.active) {
      return res.json({ tier: 'free', period: null, expires_at: null });
    }

    const period = validationResult.productId?.includes('annual') ? 'annual' : 'monthly';

    await db.query(
      `INSERT INTO user_subscriptions (user_id, tier, period, expires_at, updated_at)
       VALUES ($1, 'premium', $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET tier = 'premium', period = $2, expires_at = $3, updated_at = NOW()`,
      [req.user.id, period, validationResult.expiresAt]
    );

    res.json({ tier: 'premium', period, expires_at: validationResult.expiresAt });
  } catch (err) {
    console.error('restore error', err);
    res.status(400).json({ error: err.message ?? 'Could not restore purchase' });
  }
});

// ── Receipt validation stub ───────────────────────────────────────────────────
async function validateReceipt(receipt, platform, productId) {
  // STUB: Always returns active for now.
  // Replace with real Apple / Google validation before App Store submission.
  const period    = productId?.includes('annual') ? 'annual' : 'monthly';
  const expiresAt = new Date(
    Date.now() + (period === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
  ).toISOString();

  return { active: true, productId, expiresAt };
}

module.exports = router;
