// api/routes/index.js
// Mounts all routers under /api.

const express = require('express');

const auth = require('./auth');
const onboarding = require('./onboarding');
const chat = require('./chat');
const tracking = require('./tracking');
const content = require('./content');
const features = require('./features');
const community = require('./community');
const postpartum = require('./postpartum');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'bloom-api' }));

router.use('/auth', auth);
router.use('/onboarding', onboarding);
router.use('/chat', chat);
router.use('/tracking', tracking);
router.use('/content', content);
router.use('/features', features);
router.use('/community', community);
router.use('/postpartum', postpartum);

module.exports = router;
