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
const emergency     = require('./emergency');
const subscription  = require('./subscription');
const privacy       = require('./privacy');

const router = express.Router();

// /api/health is mounted directly in app.js (before rate limiter)
// This stub handles the case where someone hits /api/health through the router
router.get('/health', (req, res) => res.redirect('/api/health'));

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
router.use('/emergency',     emergency);
router.use('/subscription',  subscription);
router.use('/privacy',       privacy);

module.exports = router;
