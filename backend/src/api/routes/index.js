// routes/index.js — mounts all routers under /api

const express = require('express');

const auth          = require('./auth');
const user          = require('./user');
const pregnancy     = require('./pregnancy');
const onboarding    = require('./onboarding');
const tracking      = require('./tracking');
const appointments  = require('./appointments');
const birthplan     = require('./birthplan');
const content       = require('./content');
const features      = require('./features');
const community     = require('./community');
const notifications = require('./notifications');
const partner       = require('./partner');
const postpartum    = require('./postpartum');
const ai            = require('./ai');
const chat          = require('./chat');

const router = express.Router();

router.get('/health', (req, res) =>
  res.json({ success: true, data: { status: 'ok', service: 'bloom-api', version: '1.0.0' } })
);

router.use('/auth',          auth);
router.use('/user',          user);
router.use('/pregnancy',     pregnancy);
router.use('/onboarding',    onboarding);
router.use('/tracking',      tracking);
router.use('/appointments',  appointments);
router.use('/birthplan',     birthplan);
router.use('/content',       content);
router.use('/features',      features);
router.use('/community',     community);
router.use('/notifications', notifications);
router.use('/partner',       partner);
router.use('/postpartum',    postpartum);
router.use('/ai',            ai);
router.use('/chat',          chat);   // legacy alias → /ai/chat

module.exports = router;
