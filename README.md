# Bloom — Global Pregnancy Tracker

Bloom is a production-ready scaffold for a global pregnancy tracker app, supporting users
from conception through the first year of parenthood. It pairs an Express + PostgreSQL
backend with an Expo (React Native) mobile app, and uses the Anthropic Claude API
(`claude-opus-4-8`) for personalization, triage, content, and community features.

## Architecture

```
                ┌──────────────────────────────────────────────┐
  Build-time    │ contentGenerator → weekly_content (40 wks)    │
                │ pushNotifications → push copy                 │
                │ seed → emergency_resources by country         │
                └──────────────────────────────────────────────┘
  Onboarding    onboarding questions → AI personalization → user_profiles
  Every session system prompt injected (partner / postpartum variants)
  Daily use     daily tip · localization · symptom triage · mood (mental health)
                · weight guidance
  Background    symptom pattern analysis (weekly cron) · community moderation
                · reply suggester
  On-demand     contraction analyzer · birth plan · hospital bag · baby names
                · development week (cached)
  Postpartum    mode swap at week 40 / birth logged · newborn week 0–12 · PPD detection
```

### Stack
- **Mobile** — React Native (Expo ~52, expo-router, Redux Toolkit, i18n-js, TypeScript)
- **Backend** — Node.js + Express (CommonJS), `pg`, JWT auth, Zod validation, node-cron
- **Database** — PostgreSQL
- **AI** — Anthropic Claude API via `@anthropic-ai/sdk`

## Repository layout

```
backend/    Express API, prompts, services, jobs, SQL migrations
mobile/     Expo app (app/ routes, components, hooks, store, locales)
.github/    CI workflow
```

## Prerequisites
- Node.js 20+
- PostgreSQL 14+
- An Anthropic API key

## Backend setup

```bash
cd backend
cp ../.env.example .env        # then edit values (DATABASE_URL, ANTHROPIC_API_KEY, JWT secrets)
npm install
npm run migrate                # apply src/db/migrations/*.sql
npm run seed                   # emergency resources + stub weekly content
npm run dev                    # start API on PORT (default 4000)
```

Generate full AI-backed weekly content (all 40 weeks + newborn 0–12 + push copy):

```bash
npm run generate:content       # set CONTENT_LANGUAGES=English,Spanish,... to do more
```

### Key endpoints (all under `/api`)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- `POST /onboarding` — AI personalization → stored profile
- `POST /chat`, `GET /chat/history`
- `POST /tracking/symptoms|mood|weight|contractions`, `GET /tracking/history`
- `GET /content/week/:week`, `GET /content/daily-tip`, `GET /content/emergency-resources`
- `POST /features/birth-plan`, `GET /features/hospital-bag`, `POST /features/baby-names`, `GET /features/development/:week`
- `GET /community/posts`, `POST /community/posts`, `POST /community/posts/:id/moderate`
- `POST /postpartum/birth-logged`, `GET /postpartum/newborn-week/:week`

Tests (no network/DB required):

```bash
npm test
```

## Mobile setup

```bash
cd mobile
npm install
npx expo start
```

Point the app at your backend by editing `mobile/app.json` → `expo.extra.apiBaseUrl`
(default `http://localhost:4000/api`). Auth tokens are stored with `expo-secure-store`;
the axios instance auto-refreshes on 401.

### Internationalization
10+ language scaffolding via `i18n-js` and `expo-localization`. Bundled locales:
English, Spanish, French, Arabic (RTL), Hindi, Portuguese, Urdu (RTL). Add a locale by
dropping a JSON file in `mobile/locales/` and registering it in `mobile/lib/i18n.ts`.

## Safety

Bloom never diagnoses or prescribes. The system prompt enforces red-flag emergency
routing, and the backend `session` service hard-short-circuits on emergency keywords
before any model call. Symptom triage, mood analysis (with postpartum PPD detection),
and contraction analysis all escalate to "seek care" guidance when warranted.

## Environment variables

See `.env.example` for the full list (server, PostgreSQL, JWT, Anthropic, CORS, cron,
content generation, and the mobile API base URL).

## CI

`.github/workflows/ci.yml` lints and tests both workspaces on every push and PR.
