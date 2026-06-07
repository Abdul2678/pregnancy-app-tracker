// api/routes/onboarding.js
// POST /onboarding — run AI personalization and store the profile.

const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');
const { runOnboarding } = require('../../services/onboarding');
const { upsertProfile } = require('../../services/profiles');

const router = express.Router();

const onboardingSchema = z.object({
  dateInput: z.string().min(1),
  dateType: z.enum(['lmp', 'due_date', 'ivf_transfer']),
  isIvf: z.boolean().optional(),
  isFirst: z.boolean().optional(),
  previousCount: z.number().int().min(0).optional(),
  outcomes: z.array(z.string()).optional(),
  age: z.number().int().min(10).max(70).optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  goals: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
  notifPref: z.string().optional(),
});

router.post('/', authRequired, aiLimiter, validate(onboardingSchema), async (req, res, next) => {
  try {
    const profile = await runOnboarding(req.body);
    const saved = await upsertProfile(req.user.id, profile);
    return res.json({
      profile: saved,
      onboardingMessage: profile.onboardingMessage,
      suggestedFirstAction: profile.suggestedFirstAction,
      notifyDoctor: profile.notifyDoctor,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
