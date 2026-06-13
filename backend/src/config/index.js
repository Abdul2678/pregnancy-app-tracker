// src/config/index.js
// Single source of truth for all configuration.
// Fails fast on startup if required values are missing.
// NEVER logs secret values.

'use strict';

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ANTHROPIC_API_KEY',
];

function required(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return val;
}

function optional(name, fallback) {
  return process.env[name] ?? fallback;
}

function optionalInt(name, fallback) {
  const val = process.env[name];
  if (!val) return fallback;
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) {
    throw new Error(`[config] ${name} must be an integer, got: "${val}"`);
  }
  return n;
}

function optionalBool(name, fallback) {
  const val = process.env[name];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

const env = optional('NODE_ENV', 'development');
const isProd = env === 'production';
const isTest  = env === 'test';

// Fail fast in production if required vars are absent
if (isProd) {
  for (const name of REQUIRED_IN_PRODUCTION) {
    required(name);
  }
}

const config = {
  env,
  isProd,
  isTest,

  server: {
    port: optionalInt('PORT', 4000),
    trustProxy: optionalBool('TRUST_PROXY', isProd),
  },

  db: {
    url: optional('DATABASE_URL', 'postgres://bloom:bloom@localhost:5432/bloom_dev'),
    ssl: optionalBool('PGSSL', isProd),
    poolMax: optionalInt('PG_POOL_MAX', 10),
    idleTimeoutMs: optionalInt('PG_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMs: optionalInt('PG_CONN_TIMEOUT_MS', 10000),
    statementTimeoutMs: optionalInt('PG_STATEMENT_TIMEOUT_MS', isProd ? 30000 : 0),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  auth: {
    jwtSecret:        optional('JWT_SECRET',         'dev-jwt-secret'),
    jwtRefreshSecret: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    jwtExpiresIn:     optional('JWT_EXPIRES_IN',     '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
    bcryptRounds:     optionalInt('BCRYPT_ROUNDS', isProd ? 12 : 4),
  },

  claude: {
    apiKey: optional('ANTHROPIC_API_KEY', ''),
    model:  optional('CLAUDE_MODEL', 'claude-fable-5'),
    maxTokens: optionalInt('CLAUDE_MAX_TOKENS', 2048),
  },

  cors: {
    origin: optional('CORS_ORIGIN', isProd ? '' : '*'),
  },

  cron: {
    enabled: optionalBool('ENABLE_CRON', !isTest),
  },

  sentry: {
    dsn: optional('SENTRY_DSN', ''),
    environment: env,
    tracesSampleRate: isProd ? 0.1 : 0,
  },

  storage: {
    // Cloudflare R2 (S3-compatible)
    r2AccountId:   optional('R2_ACCOUNT_ID', ''),
    r2AccessKey:   optional('R2_ACCESS_KEY_ID', ''),
    r2SecretKey:   optional('R2_SECRET_ACCESS_KEY', ''),
    r2Bucket:      optional('R2_BUCKET', 'bloom-media'),
    r2PublicUrl:   optional('R2_PUBLIC_URL', 'https://media.bloompregnancy.app'),
    maxUploadBytes: optionalInt('MAX_UPLOAD_BYTES', 10 * 1024 * 1024), // 10 MB raw, resized to <1 MB
  },

  backup: {
    // S3-compatible backup target (can also be R2)
    s3Endpoint:   optional('BACKUP_S3_ENDPOINT', ''),
    s3Region:     optional('BACKUP_S3_REGION', 'auto'),
    s3Bucket:     optional('BACKUP_S3_BUCKET', 'bloom-backups'),
    s3AccessKey:  optional('BACKUP_S3_ACCESS_KEY', ''),
    s3SecretKey:  optional('BACKUP_S3_SECRET_KEY', ''),
  },

  rateLimit: {
    windowMs:   optionalInt('RATE_LIMIT_WINDOW_MS', 60 * 1000),
    maxGlobal:  optionalInt('RATE_LIMIT_MAX', isProd ? 120 : 1000),
    maxAuth:    optionalInt('RATE_LIMIT_AUTH_MAX', isProd ? 10 : 100),
    maxAi:      optionalInt('RATE_LIMIT_AI_MAX', isProd ? 30 : 200),
  },

  pushNotifications: {
    expo: {
      accessToken: optional('EXPO_ACCESS_TOKEN', ''),
    },
  },
};

// Sanity-check: warn in dev if no Claude key (AI features will fail at call time, not startup)
if (!isTest && !config.claude.apiKey) {
  // eslint-disable-next-line no-console
  console.warn('[config] ANTHROPIC_API_KEY not set — AI features will error at runtime');
}

// Log the active configuration (safe values only — never secrets)
if (!isTest) {
  // eslint-disable-next-line no-console
  console.log('[config] loaded', {
    env,
    port: config.server.port,
    dbPoolMax: config.db.poolMax,
    cronEnabled: config.cron.enabled,
    sentryEnabled: !!config.sentry.dsn,
    storageConfigured: !!(config.storage.r2AccessKey),
    claudeModel: config.claude.model,
  });
}

module.exports = config;
