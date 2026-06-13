// app.js — Express application factory

'use strict';

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
let morgan;
try { morgan = require('morgan'); } catch (_) { /* optional — not installed in test env */ }

const config         = require('./config');
const routes         = require('./api/routes');
const healthRouter   = require('./api/routes/health');
const uploadRouter   = require('./api/routes/upload');
const { apiLimiter } = require('./api/middleware/rateLimit');

// Sentry must be required early — it instruments the process
let Sentry;
if (config.sentry.dsn) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment,
      tracesSampleRate: config.sentry.tracesSampleRate,
      // Strip PII from breadcrumbs automatically
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.data?.url) {
          // Remove query strings which might contain tokens
          try {
            const u = new URL(breadcrumb.data.url);
            u.search = '';
            breadcrumb.data.url = u.toString();
          } catch (_) { /* ignore */ }
        }
        return breadcrumb;
      },
    });
  } catch (_) {
    // @sentry/node not installed — skip silently
  }
}

// Morgan token: log request ID if set by proxy (X-Request-Id)
if (morgan) {
  morgan.token('request-id', (req) => req.headers['x-request-id'] || '-');
}

// PII-safe log format: no query strings, no Authorization header values
const LOG_FORMAT = config.isProd
  ? ':request-id :method :url :status :res[content-length] - :response-time ms'
  : 'dev';

function createApp() {
  const app = express();

  // Trust reverse-proxy headers (Railway, Fly.io, Cloudflare)
  if (config.server.trustProxy) app.set('trust proxy', 1);

  // ── Sentry request handler (must be first middleware) ──────────────────────
  if (Sentry) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }

  // ── HTTPS redirect (production only) ──────────────────────────────────────
  if (config.isProd) {
    app.use((req, res, next) => {
      if (req.headers['x-forwarded-proto'] === 'http') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,   // needed for some React Native flows
    contentSecurityPolicy: config.isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'https://api.anthropic.com', 'https://exp.host'],
      },
    } : false,
  }));

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = config.cors.origin
    ? config.cors.origin.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.use(cors({
    origin: allowedOrigins.length > 0
      ? (origin, cb) => {
          // Allow requests with no Origin (mobile apps, curl, Postman)
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
        }
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }));

  // ── Request logging ────────────────────────────────────────────────────────
  if (!config.isTest && morgan) {
    app.use(morgan(LOG_FORMAT));
  }

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Health check (no rate limit, no auth) ─────────────────────────────────
  app.use('/api/health', healthRouter);

  // ── Global rate limit baseline ─────────────────────────────────────────────
  app.use('/api', apiLimiter);

  // ── All routes under /api ──────────────────────────────────────────────────
  app.use('/api/upload', uploadRouter);
  app.use('/api', routes);

  // ── Sentry error handler (must be before other error handlers) ────────────
  if (Sentry) {
    app.use(Sentry.Handlers.errorHandler());
  }

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // ── Centralised error handler ─────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;

    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error('[error]', err.message, err.stack?.split('\n')[1]?.trim());
    }

    const message = status < 500 ? err.message : 'Internal server error';
    res.status(status).json({ success: false, error: message });
  });

  return app;
}

module.exports = { createApp };
