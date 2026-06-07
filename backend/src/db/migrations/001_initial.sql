-- 001_initial.sql
-- Bloom pregnancy tracker — initial schema.
-- Comprehensive schema with foreign keys and indexes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  display_name    TEXT,
  account_type    TEXT NOT NULL DEFAULT 'primary'
                    CHECK (account_type IN ('primary', 'partner')),
  partner_of_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  refresh_token_hash TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_partner_of ON users (partner_of_user_id);

-- ── User profiles (one per user) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  due_date            DATE,
  current_week        INTEGER CHECK (current_week BETWEEN 0 AND 45),
  trimester           INTEGER CHECK (trimester BETWEEN 1 AND 3),
  is_first_pregnancy  BOOLEAN NOT NULL DEFAULT TRUE,
  is_ivf              BOOLEAN NOT NULL DEFAULT FALSE,
  age                 INTEGER,
  country             TEXT NOT NULL DEFAULT 'unknown',
  language            TEXT NOT NULL DEFAULT 'English',
  content_track       TEXT NOT NULL DEFAULT 'standard'
                        CHECK (content_track IN ('standard', 'high_risk', 'ivf', 'multiples')),
  high_risk_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  high_risk_reason    TEXT,
  goals               JSONB NOT NULL DEFAULT '[]'::jsonb,
  health_conditions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  dietary_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  feature_priorities  JSONB NOT NULL DEFAULT '[]'::jsonb,
  recent_symptoms     JSONB NOT NULL DEFAULT '[]'::jsonb,
  notif_pref          TEXT NOT NULL DEFAULT 'daily',
  push_token          TEXT,
  partner_mode        BOOLEAN NOT NULL DEFAULT FALSE,
  postpartum          BOOLEAN NOT NULL DEFAULT FALSE,
  baby_age_weeks      INTEGER,
  birth_logged_at     TIMESTAMPTZ,
  onboarding_message  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_week ON user_profiles (current_week);
CREATE INDEX IF NOT EXISTS idx_profiles_postpartum ON user_profiles (postpartum);

-- ── Conversations + messages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  mode        TEXT NOT NULL DEFAULT 'standard'
                CHECK (mode IN ('standard', 'partner', 'postpartum')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  is_emergency    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);

-- ── Tracking: symptoms, moods, weights, contractions ───────────────────────
CREATE TABLE IF NOT EXISTS symptoms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symptom_text  TEXT NOT NULL,
  severity      INTEGER CHECK (severity BETWEEN 1 AND 5),
  duration_hours NUMERIC,
  week          INTEGER,
  triage_result JSONB,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_symptoms_user ON symptoms (user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS moods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mood          TEXT NOT NULL,
  note          TEXT,
  week          INTEGER,
  risk_level    TEXT,
  analysis      JSONB,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moods_user ON moods (user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS weights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg     NUMERIC NOT NULL,
  week          INTEGER,
  guidance      JSONB,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weights_user ON weights (user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS contractions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL DEFAULT gen_random_uuid(),
  start_time    TIMESTAMPTZ NOT NULL,
  duration_sec  INTEGER,
  interval_sec  INTEGER,
  analysis      JSONB,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractions_user ON contractions (user_id, session_id, start_time);

-- ── Cached build-time content ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week          INTEGER NOT NULL CHECK (week BETWEEN 0 AND 45),
  track         TEXT NOT NULL DEFAULT 'standard',
  language      TEXT NOT NULL DEFAULT 'English',
  phase         TEXT NOT NULL DEFAULT 'pregnancy'
                  CHECK (phase IN ('pregnancy', 'newborn')),
  content       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week, track, language, phase)
);
CREATE INDEX IF NOT EXISTS idx_weekly_content_lookup
  ON weekly_content (week, track, language, phase);

CREATE TABLE IF NOT EXISTS push_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week          INTEGER NOT NULL,
  language      TEXT NOT NULL DEFAULT 'English',
  phase         TEXT NOT NULL DEFAULT 'pregnancy',
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  category      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week, language, phase, category)
);
CREATE INDEX IF NOT EXISTS idx_push_lookup ON push_notifications (week, language, phase);

CREATE TABLE IF NOT EXISTS emergency_resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country       TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'English',
  emergency_number TEXT NOT NULL,
  resources     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country, language)
);
CREATE INDEX IF NOT EXISTS idx_emergency_country ON emergency_resources (country);

-- ── Community ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_post_id  UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  title           TEXT,
  body            TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'English',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'review', 'blocked')),
  moderation      JSONB,
  like_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON community_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON community_posts (parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON community_posts (user_id);

-- ── Baby names ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS baby_names (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  gender        TEXT,
  origin        TEXT,
  meaning       TEXT,
  pronunciation TEXT,
  favorited     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baby_names_user ON baby_names (user_id, favorited);
