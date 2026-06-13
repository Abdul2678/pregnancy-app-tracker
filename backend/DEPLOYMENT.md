# Bloom Backend — Deployment Guide

## Table of Contents
1. [Local Development with Docker](#1-local-development-with-docker)
2. [Environment Variables](#2-environment-variables)
3. [Deploy to Railway (Production)](#3-deploy-to-railway-production)
4. [Cloudflare R2 (Media Storage)](#4-cloudflare-r2-media-storage)
5. [Sentry (Error Tracking)](#5-sentry-error-tracking)
6. [Daily Database Backups](#6-daily-database-backups)
7. [Security Hardening Reference](#7-security-hardening-reference)
8. [Health Check & Monitoring](#8-health-check--monitoring)
9. [Post-Deploy Verification](#9-post-deploy-verification)

---

## 1. Local Development with Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed

### Start everything
```bash
cd backend

# Copy and fill in your env file
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY

# Start API + PostgreSQL + Redis
docker compose up

# First run: apply DB migrations
docker compose exec api npm run migrate

# (Optional) open Adminer DB browser at http://localhost:8080
docker compose --profile tools up
```

### Useful commands
```bash
# Rebuild after changing package.json
docker compose up --build

# Run tests inside the container
docker compose exec api npm test

# Access psql
docker compose exec postgres psql -U bloom bloom_dev

# Stop and remove volumes (full reset)
docker compose down -v
```

The API will be available at `http://localhost:4000`.

---

## 2. Environment Variables

All configuration is defined in `src/config/index.js`. The server **will refuse to start in production** if any required variable is missing.

Copy `.env.example` to `.env` and fill in every `CHANGE_ME` value.

### Generating secrets
```bash
# JWT_SECRET and JWT_REFRESH_SECRET — each must be unique
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Required in production
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key (different from above) |
| `ANTHROPIC_API_KEY` | Claude API key |

### Optional but recommended
| Variable | Default | Purpose |
|---|---|---|
| `SENTRY_DSN` | — | Error tracking |
| `R2_ACCESS_KEY_ID` | — | Media uploads |
| `BACKUP_S3_ACCESS_KEY` | — | Daily DB backups |
| `CORS_ORIGIN` | `*` | Allowed client origins |
| `ENABLE_CRON` | `true` | Background jobs |

---

## 3. Deploy to Railway (Production)

Railway is the recommended hosting for solo developers: free Postgres included, deploys from Git, zero DevOps.

### First-time setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create a new project
railway init

# Link this directory to the project
railway link
```

### Add PostgreSQL
In the Railway dashboard → your project → **New** → **Database** → **PostgreSQL**.
Railway automatically sets `DATABASE_URL` in your service.

### Set environment variables
Either via the Railway dashboard (Settings → Variables) or CLI:

```bash
# Required
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
railway variables set JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
railway variables set ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
railway variables set PGSSL=true
railway variables set TRUST_PROXY=true
railway variables set CORS_ORIGIN=https://your-production-domain.com

# Recommended
railway variables set SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
railway variables set R2_ACCOUNT_ID=xxx
railway variables set R2_ACCESS_KEY_ID=xxx
railway variables set R2_SECRET_ACCESS_KEY=xxx
railway variables set R2_PUBLIC_URL=https://media.bloompregnancy.app
```

### Deploy

```bash
# Deploy current branch
railway up

# Or connect your GitHub repo for automatic deploys on push
# Dashboard → Settings → Source → GitHub repo
```

Railway will:
1. Run `npm ci --omit=dev`
2. Execute `node src/db/migrate.js` (from `railway.json` startCommand)
3. Start `node src/server.js`
4. Health-check `GET /api/health` — only routes traffic when 200

### Custom domain
Dashboard → Settings → Networking → Custom Domain → enter `api.bloompregnancy.app`.
Railway provides the CNAME to point your DNS to.

### Scaling
For production traffic, set replicas in the Railway dashboard. The app is stateless so horizontal scaling works out of the box.

---

## 4. Cloudflare R2 (Media Storage)

R2 is S3-compatible object storage at ~$0.015/GB — far cheaper than S3 for a small app.

### Setup
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → R2
2. Create bucket: `bloom-media`
3. Create API token: R2 → Manage R2 API Tokens → Create Token (Object Read & Write)
4. Note your **Account ID** from the R2 dashboard

```bash
railway variables set R2_ACCOUNT_ID=your_account_id
railway variables set R2_ACCESS_KEY_ID=your_access_key
railway variables set R2_SECRET_ACCESS_KEY=your_secret
railway variables set R2_BUCKET=bloom-media
railway variables set R2_PUBLIC_URL=https://media.bloompregnancy.app
```

### Custom domain for R2
In the R2 bucket settings → Custom Domains → add `media.bloompregnancy.app`.
Cloudflare handles the certificate automatically.

### Upload endpoint
```
POST /api/upload
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
Body: image=<file>

Response: { "success": true, "data": { "url": "https://media.bloompregnancy.app/uploads/uuid.webp" } }
```
- Images are auto-resized to max 1200×1200 px and converted to WebP
- Max raw upload: 10 MB (configurable via `MAX_UPLOAD_BYTES`)
- Stored size always < 1 MB

---

## 5. Sentry (Error Tracking)

Sentry's free tier covers up to 5,000 errors/month — plenty for launch.

### Setup
1. [Create a free account](https://sentry.io/signup/)
2. New Project → Node.js
3. Copy your DSN

```bash
railway variables set SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

Sentry will automatically capture:
- Unhandled exceptions and promise rejections
- Request/response metadata (without PII — query strings are stripped)
- 10% of traces for performance monitoring

### Test Sentry is working
```bash
curl https://api.bloompregnancy.app/api/debug/sentry-test
# Should create an error in your Sentry dashboard
```

---

## 6. Daily Database Backups

The backup job (`src/jobs/backupJob.js`) runs at **03:00 UTC** in production:
- `pg_dump` → gzip compress → upload to R2/S3 as `backups/bloom-YYYY-MM-DD.sql.gz`

### Configure backup storage
```bash
# Can reuse R2 credentials with a separate bucket
railway variables set BACKUP_S3_ENDPOINT=https://YOUR_ACCOUNT.r2.cloudflarestorage.com
railway variables set BACKUP_S3_REGION=auto
railway variables set BACKUP_S3_BUCKET=bloom-backups
railway variables set BACKUP_S3_ACCESS_KEY=your_access_key
railway variables set BACKUP_S3_SECRET_KEY=your_secret
```

### Manual backup trigger
```bash
# Run from inside the container / Railway shell
node -e "require('./src/jobs/backupJob').runBackup().then(() => process.exit(0)).catch(console.error)"
```

### Restore from backup
```bash
# Download the backup
aws s3 cp s3://bloom-backups/backups/bloom-2026-06-13.sql.gz . \
  --endpoint-url https://ACCOUNT.r2.cloudflarestorage.com

# Decompress and restore
gunzip bloom-2026-06-13.sql.gz
psql $DATABASE_URL < bloom-2026-06-13.sql
```

### Retention policy
Set a lifecycle rule in R2 to auto-delete backups older than 30 days:
R2 bucket → Settings → Lifecycle → Add rule → Delete after 30 days.

---

## 7. Security Hardening Reference

All of the following are implemented in `src/app.js` and `src/config/index.js`.

| Protection | Implementation |
|---|---|
| Security headers | `helmet()` — X-Content-Type-Options, X-Frame-Options, HSTS, etc. |
| HTTPS enforcement | HTTP → HTTPS redirect in production (via `X-Forwarded-Proto`) |
| CORS | Whitelist of allowed origins via `CORS_ORIGIN` env var |
| Rate limiting | 120 req/min global, 10/min on auth routes, 30/min on AI routes |
| Input validation | `zod` schemas on all route inputs |
| SQL injection | All queries use parameterised `pool.query(text, params)` — never string concat |
| JWT | HS256, 15-min access tokens, 30-day rotating refresh tokens |
| Passwords | bcrypt rounds=12 in production |
| PII in logs | Morgan log format strips query strings and headers with tokens |
| Sentry | Query strings stripped from breadcrumbs before sending |
| Non-root Docker | Production container runs as UID 1001 (non-root) |
| Image uploads | Multer memory storage — raw bytes never touch disk |

### Adding `express-validator` to a route

```js
const { body, validationResult } = require('express-validator');

router.post('/example',
  body('email').isEmail().normalizeEmail(),
  body('age').isInt({ min: 0, max: 120 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
  handler
);
```

---

## 8. Health Check & Monitoring

### Endpoint
```
GET /api/health
```
No authentication required. Used by Railway's health check probe.

**Healthy response (200):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "env": "production",
  "uptime": 3842,
  "db": "ok",
  "timestamp": "2026-06-13T10:00:00.000Z"
}
```

**Degraded response (503):**
```json
{
  "status": "degraded",
  "db": "error",
  ...
}
```

### Uptime monitoring (free)
Use [Better Uptime](https://betterstack.com/uptime) or [UptimeRobot](https://uptimerobot.com) — both have free tiers:
- Monitor URL: `https://api.bloompregnancy.app/api/health`
- Check interval: 1 minute
- Alert: email + SMS on status 503

---

## 9. Post-Deploy Verification

Run these checks after every production deployment:

```bash
export API=https://api.bloompregnancy.app

# 1. Health check
curl -s $API/api/health | jq .

# 2. 404 handling
curl -s $API/api/nonexistent | jq .

# 3. Auth rejects unauthenticated requests
curl -s $API/api/user/me | jq .   # should return 401

# 4. HTTPS redirect
curl -I http://api.bloompregnancy.app/api/health   # should return 301

# 5. Security headers present
curl -I $API/api/health | grep -E 'x-content-type|x-frame|strict-transport'

# 6. Register a test user
curl -s -X POST $API/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoketest@example.com","password":"Secure1234!"}' | jq .

# 7. Rate limit works (run quickly)
for i in {1..15}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST $API/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"x@x.com","password":"wrong"}'
done
# Should see 401s then eventually 429
```

### Smoke test checklist
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] DB probe passes (`"db":"ok"`)
- [ ] Unauthenticated routes return 401
- [ ] HTTP → HTTPS redirect working (301)
- [ ] `X-Frame-Options: SAMEORIGIN` header present
- [ ] Auth rate limit triggers after 10 failed attempts (429)
- [ ] Sentry receives a test event
- [ ] Register + login flow works end to end
- [ ] AI chat returns a response (tests Claude key is valid)
