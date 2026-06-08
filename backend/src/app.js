// app.js — Express application factory

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');

const routes         = require('./api/routes');
const { apiLimiter } = require('./api/middleware/rateLimit');

function createApp() {
  const app = express();

  // Trust reverse-proxy headers (fly.io, Railway, etc.)
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limit baseline
  app.use('/api', apiLimiter);

  // All routes under /api
  app.use('/api', routes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // Centralised error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('[error]', err.message || err);

    const status = err.status || err.statusCode || 500;
    const message = status < 500 ? err.message : 'Internal server error';

    res.status(status).json({ success: false, error: message });
  });

  return app;
}

module.exports = { createApp };
