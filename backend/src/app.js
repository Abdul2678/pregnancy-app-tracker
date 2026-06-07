// app.js
// Express application setup with all middleware.

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const routes = require('./api/routes');
const { apiLimiter } = require('./api/middleware/rateLimit');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global baseline rate limit
  app.use('/api', apiLimiter);

  // Routes
  app.use('/api', routes);

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Centralised error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    const status = err.status || 500;
    res.status(status).json({
      error: status === 500 ? 'Internal server error' : err.message,
    });
  });

  return app;
}

module.exports = { createApp };
