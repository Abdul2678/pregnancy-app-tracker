-- =============================================================================
-- Bloom Pregnancy Tracker — Complete Database Schema
-- Migration: 001_initial.sql
-- =============================================================================
-- Design principles:
--   • UUIDs everywhere (portable, no enumeration attacks)
--   • TIMESTAMPTZ for all timestamps (timezone-aware)
--   • JSONB for flexible/evolving fields; structured columns for queryable fields
--   • Soft deletes on user-facing data (deleted_at IS NULL filters)
--   • Covering indexes on every hot query path
--   • Strict CHECKs at the DB layer — app validation is a second line of defence
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram indexes for text search

-- ---------------------------------------------------------------------------
-- Utility: auto-update updated_at on any table that has it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 1. USERS
-- =============================================================================
-- Core auth record. One row per account (primary or partner).
-- Profile, pregnancy, and tracking data live in separate tables.

CREATE TABLE IF NOT EXISTS users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT        NOT NULL UNIQUE,
  password_hash       TEXT        NOT NULL,
  display_name        TEXT,
  avatar_url          TEXT,

  -- Account type: 'primary' = the pregnant person, 'partner' = linked partner
  account_type        TEXT        NOT NULL DEFAULT 'primary'
                        CHECK (account_type IN ('primary', 'partner', 'admin')),

  -- Auth tokens
  refresh_token_hash  TEXT,
  email_verified      BOOLEAN     NOT NULL DEFAULT FALSE,
  email_verify_token  TEXT,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,

  -- Soft delete
  deleted_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email        ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at   ON users (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 2. USER_PARTNERS
-- =============================================================================
-- Explicit many-to-one link: one primary user may have one partner account.
-- Kept in its own table so it can carry invite state.

CREATE TABLE IF NOT EXISTS user_partners (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,

  -- Before the partner creates an account, we store the invite
  invite_email      TEXT,
  invite_token      TEXT        UNIQUE,
  invite_expires_at TIMESTAMPTZ,

  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'revoked')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (primary_user_id)   -- one partner slot per primary user
);

CREATE INDEX IF NOT EXISTS idx_partners_primary  ON user_partners (primary_user_id);
CREATE INDEX IF NOT EXISTS idx_partners_partner  ON user_partners (partner_user_id);
CREATE INDEX IF NOT EXISTS idx_partners_invite   ON user_partners (invite_token) WHERE invite_token IS NOT NULL;

CREATE TRIGGER trg_user_partners_updated_at
  BEFORE UPDATE ON user_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 3. PREGNANCIES
-- =============================================================================
-- A user may have multiple pregnancies over time (previous + current).
-- Only one pregnancy per user is current (is_current = TRUE).

CREATE TABLE IF NOT EXISTS pregnancies (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Date inputs (one of these is provided at onboarding)
  lmp_date            DATE,                          -- Last Menstrual Period
  due_date            DATE,                          -- Calculated or provided
  ivf_transfer_date   DATE,                          -- For IVF pregnancies

  -- AI-calculated fields (populated by onboarding service)
  calculated_due_date DATE,
  current_week        SMALLINT    CHECK (current_week BETWEEN 0 AND 45),
  trimester           SMALLINT    CHECK (trimester BETWEEN 1 AND 3),

  -- Pregnancy characteristics
  is_ivf              BOOLEAN     NOT NULL DEFAULT FALSE,
  is_multiples        BOOLEAN     NOT NULL DEFAULT FALSE,
  multiples_count     SMALLINT    DEFAULT 1 CHECK (multiples_count BETWEEN 1 AND 8),
  is_first_pregnancy  BOOLEAN     NOT NULL DEFAULT TRUE,
  previous_count      SMALLINT    NOT NULL DEFAULT 0 CHECK (previous_count >= 0),
  previous_outcomes   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- e.g. ["live_birth", "miscarriage", "stillbirth", "termination"]

  -- Risk and content
  high_risk_flag      BOOLEAN     NOT NULL DEFAULT FALSE,
  high_risk_reason    TEXT,
  content_track       TEXT        NOT NULL DEFAULT 'standard'
                        CHECK (content_track IN ('standard', 'high_risk', 'ivf', 'multiples')),

  -- State
  is_current          BOOLEAN     NOT NULL DEFAULT TRUE,
  outcome             TEXT        CHECK (outcome IN ('ongoing', 'live_birth', 'stillbirth',
                                                     'miscarriage', 'termination', 'ectopic')),
  birth_date          DATE,
  birth_weight_grams  INTEGER,
  birth_length_cm     NUMERIC(5,2),
  birth_type          TEXT        CHECK (birth_type IN ('vaginal', 'c_section', 'vbac', 'assisted')),
  birth_notes         TEXT,

  -- Doctor flag from onboarding AI
  notify_doctor       BOOLEAN     NOT NULL DEFAULT FALSE,
  notify_doctor_reason TEXT,

  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one current pregnancy per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_pregnancies_current
  ON pregnancies (user_id) WHERE is_current = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pregnancies_user
  ON pregnancies (user_id, created_at DESC);

CREATE TRIGGER trg_pregnancies_updated_at
  BEFORE UPDATE ON pregnancies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 4. USER_PROFILES
-- =============================================================================
-- Non-pregnancy user preferences and app state. One row per user.

CREATE TABLE IF NOT EXISTS user_profiles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Demographics
  age                   SMALLINT    CHECK (age BETWEEN 13 AND 80),
  country               TEXT        NOT NULL DEFAULT 'unknown',
  language              TEXT        NOT NULL DEFAULT 'en',
  timezone              TEXT        NOT NULL DEFAULT 'UTC',
  unit_system           TEXT        NOT NULL DEFAULT 'metric'
                          CHECK (unit_system IN ('metric', 'imperial')),

  -- Health baseline
  height_cm             NUMERIC(5,2),
  pre_pregnancy_weight_kg NUMERIC(6,2),
  blood_type            TEXT        CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  health_conditions     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  dietary_restrictions  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- e.g. ["vegetarian","vegan","halal","kosher","gluten_free","lactose_free"]
  allergies             JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Goals selected at onboarding
  goals                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- ["track_symptoms","learn","community","partner_connect","medical_track"]

  -- AI-generated onboarding artefacts
  feature_priorities    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  first_tip_category    TEXT,
  onboarding_message    TEXT,
  suggested_first_action TEXT,

  -- Notification preferences
  notif_pref            TEXT        NOT NULL DEFAULT 'daily'
                          CHECK (notif_pref IN ('off', 'daily', 'weekly')),
  push_token            TEXT,
  push_platform         TEXT        CHECK (push_platform IN ('ios', 'android', 'web')),
  quiet_hours_start     TIME,
  quiet_hours_end       TIME,

  -- App state
  partner_mode          BOOLEAN     NOT NULL DEFAULT FALSE,
  postpartum_mode       BOOLEAN     NOT NULL DEFAULT FALSE,
  last_active_at        TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user       ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_country    ON user_profiles (country);
CREATE INDEX IF NOT EXISTS idx_profiles_language   ON user_profiles (language);
CREATE INDEX IF NOT EXISTS idx_profiles_postpartum ON user_profiles (postpartum_mode) WHERE postpartum_mode = TRUE;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 5. PREGNANCY_WEEKS_CACHE
-- =============================================================================
-- Pre-generated, AI-authored content for all 40 pregnancy weeks.
-- Generated once at build/deploy time, updated periodically.
-- Also covers newborn weeks 0-12 (postpartum phase).

CREATE TABLE IF NOT EXISTS pregnancy_weeks_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week        SMALLINT    NOT NULL CHECK (week BETWEEN 0 AND 45),
  -- week 0 = conception week; weeks 41-45 cover overdue; weeks 0-12 in newborn phase = baby age weeks
  phase       TEXT        NOT NULL DEFAULT 'pregnancy'
                CHECK (phase IN ('pregnancy', 'newborn')),
  track       TEXT        NOT NULL DEFAULT 'standard'
                CHECK (track IN ('standard', 'high_risk', 'ivf', 'multiples')),
  language    TEXT        NOT NULL DEFAULT 'en',

  -- Fetal / baby development
  baby_size_description   TEXT        NOT NULL,  -- "the size of a lemon"
  baby_size_cm            NUMERIC(5,2),
  baby_weight_grams       NUMERIC(8,2),
  development_highlights  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "system": "brain", "detail": "..." }, ...]
  organ_systems_forming   JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Parent experience
  common_symptoms         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  body_changes            TEXT,
  emotional_changes       TEXT,

  -- Guidance
  nutrition_tips          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  exercise_guidance       TEXT,
  things_to_avoid         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  appointments_this_week  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "type": "anatomy_scan", "description": "..." }]
  screening_tests         JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Weekly checklist (Flo-style)
  checklist               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "item": "...", "category": "health|nutrition|preparation|admin" }]

  -- Fun / engagement
  partner_tip             TEXT,
  affirmation             TEXT,
  did_you_know            TEXT,

  -- Meta
  sources                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- ["WHO", "ACOG", "NHS"]
  is_stub                 BOOLEAN     NOT NULL DEFAULT FALSE,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,           -- set when medically reviewed

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (week, phase, track, language)
);

CREATE INDEX IF NOT EXISTS idx_weeks_cache_lookup
  ON pregnancy_weeks_cache (week, phase, track, language);

CREATE TRIGGER trg_weeks_cache_updated_at
  BEFORE UPDATE ON pregnancy_weeks_cache
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 6. SYMPTOM_LOGS
-- =============================================================================
-- Every symptom the user logs. Triggers an AI triage call on the backend.

CREATE TABLE IF NOT EXISTS symptom_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  -- What they logged
  symptom_name    TEXT        NOT NULL,      -- normalised name, e.g. "nausea"
  symptom_raw     TEXT,                       -- free-text as typed
  severity        SMALLINT    NOT NULL CHECK (severity BETWEEN 1 AND 5),
  duration_hours  NUMERIC(6,2),
  body_location   TEXT,                       -- "lower abdomen", "head", etc.
  notes           TEXT,

  -- Pregnancy context at log time (denormalised for analytics)
  pregnancy_week  SMALLINT,
  trimester       SMALLINT,

  -- AI triage result
  triage_result   JSONB,
  -- {
  --   "urgency": "routine|monitor|call_provider|emergency",
  --   "explanation": "...",
  --   "suggested_actions": [...],
  --   "emergency_triggered": false
  -- }
  is_emergency    BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Pattern analysis (populated by weekly background job)
  pattern_flag    BOOLEAN     NOT NULL DEFAULT FALSE,
  pattern_note    TEXT,

  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_symptoms_user_time
  ON symptom_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_symptoms_pregnancy
  ON symptom_logs (pregnancy_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_symptoms_name
  ON symptom_logs (user_id, symptom_name);
CREATE INDEX IF NOT EXISTS idx_symptoms_emergency
  ON symptom_logs (is_emergency) WHERE is_emergency = TRUE;
-- Trigram index for symptom name search
CREATE INDEX IF NOT EXISTS idx_symptoms_name_trgm
  ON symptom_logs USING gin (symptom_name gin_trgm_ops);


-- =============================================================================
-- 7. MOOD_LOGS
-- =============================================================================
-- Mood/emotion tracking with PPD screening built in.

CREATE TABLE IF NOT EXISTS mood_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  -- Primary mood (from a fixed set, localised in UI)
  mood            TEXT        NOT NULL,
  -- e.g. "happy","anxious","sad","excited","overwhelmed","calm","tired","irritable"

  -- Numeric score 1-10 (1=very low, 10=very high)
  mood_score      SMALLINT    CHECK (mood_score BETWEEN 1 AND 10),

  -- Secondary emotions (multi-select)
  emotions        JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Free text
  note            TEXT,

  -- Edinburgh Postnatal Depression Scale (EPDS) — optional, done periodically
  epds_responses  JSONB,      -- [{ "q": 1, "score": 0 }, ...]
  epds_total      SMALLINT,   -- 0-30; >= 10 triggers provider alert
  epds_taken_at   TIMESTAMPTZ,

  -- Pregnancy context
  pregnancy_week  SMALLINT,
  is_postpartum   BOOLEAN     NOT NULL DEFAULT FALSE,

  -- AI mental health analysis
  risk_level      TEXT        CHECK (risk_level IN ('low', 'moderate', 'high', 'crisis')),
  analysis        JSONB,
  -- {
  --   "observation": "...",
  --   "suggested_actions": [...],
  --   "ppd_flag": false,
  --   "recommend_professional": false
  -- }
  ppd_flag        BOOLEAN     NOT NULL DEFAULT FALSE,

  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moods_user_time
  ON mood_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_moods_ppd
  ON mood_logs (user_id, ppd_flag) WHERE ppd_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_moods_risk
  ON mood_logs (user_id, risk_level) WHERE risk_level IN ('high','crisis');
CREATE INDEX IF NOT EXISTS idx_moods_epds
  ON mood_logs (user_id, epds_taken_at) WHERE epds_taken_at IS NOT NULL;


-- =============================================================================
-- 8. WEIGHT_LOGS
-- =============================================================================
-- Weight entries. Stored always in kg; UI converts to lbs/st if needed.

CREATE TABLE IF NOT EXISTS weight_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  weight_kg       NUMERIC(6,2) NOT NULL CHECK (weight_kg > 0),

  -- Pregnancy context
  pregnancy_week  SMALLINT,
  bmi_at_log      NUMERIC(5,2),   -- calculated from height on insert

  -- AI weight guidance
  guidance        JSONB,
  -- {
  --   "status": "on_track|below|above",
  --   "recommended_range_kg": [x, y],
  --   "total_gained_kg": z,
  --   "message": "...",
  --   "iom_track": "normal|underweight|overweight|obese"
  -- }

  notes           TEXT,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weights_user_time
  ON weight_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_weights_pregnancy
  ON weight_logs (pregnancy_id, logged_at DESC);


-- =============================================================================
-- 9. KICK_COUNTER_SESSIONS
-- =============================================================================
-- One session = user sits and counts kicks until they reach their target.
-- Individual kicks stored as a JSONB array of timestamps for simplicity.

CREATE TABLE IF NOT EXISTS kick_counter_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  pregnancy_week  SMALLINT,

  -- Session window
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_minutes NUMERIC(6,2),

  -- Kick timestamps (array of ISO strings stored as JSONB)
  kick_times      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  kick_count      SMALLINT    NOT NULL DEFAULT 0,

  -- Target (default: 10 kicks in 2 hours — per ACOG)
  target_kicks    SMALLINT    NOT NULL DEFAULT 10,
  target_met      BOOLEAN     NOT NULL DEFAULT FALSE,
  target_met_at   TIMESTAMPTZ,

  -- Position user was in
  position        TEXT        CHECK (position IN ('left_side','right_side','sitting','standing')),

  -- AI assessment
  assessment      JSONB,
  -- { "status": "normal|below_normal|above_normal", "message": "...", "seek_care": false }

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kick_user_time
  ON kick_counter_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_kick_pregnancy
  ON kick_counter_sessions (pregnancy_id, started_at DESC);

CREATE TRIGGER trg_kick_sessions_updated_at
  BEFORE UPDATE ON kick_counter_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 10. CONTRACTION_SESSIONS
-- =============================================================================
-- A session groups all contractions in one labour monitoring window.

CREATE TABLE IF NOT EXISTS contraction_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  pregnancy_week  SMALLINT,

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Aggregate stats (recalculated on each contraction addition)
  total_contractions  INTEGER NOT NULL DEFAULT 0,
  avg_duration_sec    NUMERIC(7,2),
  avg_interval_sec    NUMERIC(7,2),
  min_interval_sec    NUMERIC(7,2),
  max_duration_sec    NUMERIC(7,2),

  -- AI analysis of the session
  analysis        JSONB,
  -- {
  --   "pattern": "irregular|early_labor|active_labor|transition",
  --   "511_rule_met": false,   -- 5 min apart, 1 min long, for 1 hour
  --   "recommendation": "...",
  --   "go_to_hospital": false
  -- }
  go_to_hospital  BOOLEAN     NOT NULL DEFAULT FALSE,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contraction_sessions_user
  ON contraction_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_contraction_sessions_active
  ON contraction_sessions (user_id, is_active) WHERE is_active = TRUE;

CREATE TRIGGER trg_contraction_sessions_updated_at
  BEFORE UPDATE ON contraction_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Individual contraction events within a session
CREATE TABLE IF NOT EXISTS contraction_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES contraction_sessions(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  duration_sec    NUMERIC(7,2),   -- end_time - start_time
  interval_sec    NUMERIC(7,2),   -- time since previous contraction started
  intensity       SMALLINT    CHECK (intensity BETWEEN 1 AND 5),
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contraction_events_session
  ON contraction_events (session_id, start_time);
CREATE INDEX IF NOT EXISTS idx_contraction_events_user
  ON contraction_events (user_id, start_time DESC);


-- =============================================================================
-- 11. APPOINTMENTS
-- =============================================================================
-- Prenatal and postpartum appointments with reminder support.

CREATE TABLE IF NOT EXISTS appointments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  title           TEXT        NOT NULL,
  type            TEXT        NOT NULL DEFAULT 'general'
                    CHECK (type IN (
                      'general','midwife','obgyn','ultrasound','blood_test',
                      'glucose_test','gbs_test','anatomy_scan','nst',
                      'postpartum_checkup','pediatric','dental','other'
                    )),

  -- When
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT   DEFAULT 30,
  timezone        TEXT        DEFAULT 'UTC',

  -- Where
  location_name   TEXT,
  location_address TEXT,
  provider_name   TEXT,

  -- Reminders (array of minutes-before values)
  reminder_minutes JSONB      NOT NULL DEFAULT '[1440, 60]'::jsonb,
  -- [1440, 60] = 24h before and 1h before

  -- State
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  completed_at    TIMESTAMPTZ,
  notes           TEXT,

  -- Pregnancy context
  pregnancy_week  SMALLINT,

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_user_time
  ON appointments (user_id, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming
  ON appointments (user_id, scheduled_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 12. MEDICATION_REMINDERS
-- =============================================================================
-- Vitamins, supplements, and prescriptions with dosage schedules.

CREATE TABLE IF NOT EXISTS medication_reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  name            TEXT        NOT NULL,     -- "Folic acid", "Iron", "Aspirin"
  category        TEXT        NOT NULL DEFAULT 'supplement'
                    CHECK (category IN ('supplement','vitamin','prescription','otc','herbal')),
  dosage          TEXT,                     -- "400 mcg", "1 tablet"
  instructions    TEXT,                     -- "Take with food"

  -- Frequency
  frequency       TEXT        NOT NULL DEFAULT 'daily'
                    CHECK (frequency IN ('once','daily','twice_daily','three_times','weekly','as_needed')),
  times_of_day    JSONB       NOT NULL DEFAULT '["08:00"]'::jsonb,
  -- ["08:00", "20:00"]

  -- Active window
  start_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,                     -- NULL = ongoing

  -- State
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  prescribed_by   TEXT,

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id     UUID        NOT NULL REFERENCES medication_reminders(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  skipped         BOOLEAN     NOT NULL DEFAULT FALSE,
  skip_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_reminders_user
  ON medication_reminders (user_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_med_logs_reminder
  ON medication_logs (reminder_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_logs_user
  ON medication_logs (user_id, taken_at DESC);

CREATE TRIGGER trg_medication_reminders_updated_at
  BEFORE UPDATE ON medication_reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 13. BIRTH_PLANS
-- =============================================================================
-- AI-generated birth plan based on user preferences form.

CREATE TABLE IF NOT EXISTS birth_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  title           TEXT        NOT NULL DEFAULT 'My Birth Plan',

  -- Raw preferences submitted by user (the "form")
  preferences     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- {
  --   "pain_management": ["epidural"],
  --   "birth_environment": "dim_lights",
  --   "support_people": ["partner","doula"],
  --   "delayed_cord_clamping": true,
  --   "skin_to_skin": true,
  --   "feeding_intention": "breastfeed",
  --   "c_section_preferences": {...},
  --   "newborn_procedures": {...}
  -- }

  -- AI-generated plan text (formatted, ready to print/share)
  generated_plan  TEXT,
  plan_sections   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "section": "Labour & Delivery", "items": [...] }]

  -- Version tracking (user can regenerate)
  version         SMALLINT    NOT NULL DEFAULT 1,
  is_final        BOOLEAN     NOT NULL DEFAULT FALSE,
  shared_with_provider BOOLEAN NOT NULL DEFAULT FALSE,

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_birth_plans_user
  ON birth_plans (user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_birth_plans_updated_at
  BEFORE UPDATE ON birth_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 14. HOSPITAL_BAG_ITEMS
-- =============================================================================
-- Per-user checklist. Pre-populated from a template, customisable.

CREATE TABLE IF NOT EXISTS hospital_bag_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  item_name       TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'documents','labour','postpartum_parent',
                      'baby','comfort','partner','other'
                    )),
  is_checked      BOOLEAN     NOT NULL DEFAULT FALSE,
  is_essential    BOOLEAN     NOT NULL DEFAULT FALSE,
  notes           TEXT,
  sort_order      SMALLINT    NOT NULL DEFAULT 0,

  -- Template items have a template_key so they can be re-seeded / translated
  template_key    TEXT,

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bag_user
  ON hospital_bag_items (user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bag_template
  ON hospital_bag_items (template_key) WHERE template_key IS NOT NULL;

CREATE TRIGGER trg_hospital_bag_updated_at
  BEFORE UPDATE ON hospital_bag_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 15. CONVERSATIONS + MESSAGES
-- =============================================================================
-- Chat sessions with the Bloom AI companion.

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id UUID       REFERENCES pregnancies(id) ON DELETE SET NULL,

  title       TEXT,
  mode        TEXT        NOT NULL DEFAULT 'standard'
                CHECK (mode IN ('standard', 'partner', 'postpartum')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,

  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON conversations (user_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT        NOT NULL,

  -- Safety
  is_emergency    BOOLEAN     NOT NULL DEFAULT FALSE,
  emergency_keywords TEXT[],  -- which keywords triggered the flag

  -- Token accounting (for cost tracking)
  input_tokens    INTEGER,
  output_tokens   INTEGER,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user
  ON messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_emergency
  ON messages (is_emergency) WHERE is_emergency = TRUE;


-- =============================================================================
-- 16. COMMUNITY_POSTS
-- =============================================================================
-- Forum-style posts. AI moderation runs before approval.

CREATE TABLE IF NOT EXISTS community_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title           TEXT,
  body            TEXT        NOT NULL,
  language        TEXT        NOT NULL DEFAULT 'en',

  -- Taxonomy
  category        TEXT        NOT NULL DEFAULT 'general'
                    CHECK (category IN (
                      'general','symptoms','nutrition','mental_health',
                      'birth_stories','newborn','partner','loss_support','ivf','multiples'
                    )),
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  pregnancy_week  SMALLINT,   -- context when posted

  -- Moderation (AI + human)
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','flagged','removed')),
  moderation      JSONB,
  -- {
  --   "safe": true,
  --   "flags": [],
  --   "confidence": 0.97,
  --   "reviewed_by": "ai|human",
  --   "reviewed_at": "ISO"
  -- }
  ai_reply_suggestion TEXT,   -- populated by reply-suggester background job

  -- Engagement
  view_count      INTEGER     NOT NULL DEFAULT 0,
  like_count      INTEGER     NOT NULL DEFAULT 0,
  reply_count     INTEGER     NOT NULL DEFAULT 0,

  is_pinned       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_anonymous    BOOLEAN     NOT NULL DEFAULT FALSE,

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_status_time
  ON community_posts (status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_user
  ON community_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category
  ON community_posts (category, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_unanswered
  ON community_posts (reply_count, created_at DESC)
  WHERE status = 'approved' AND reply_count = 0 AND deleted_at IS NULL;
-- Full-text search
CREATE INDEX IF NOT EXISTS idx_posts_fts
  ON community_posts USING gin (to_tsvector('english', coalesce(title,'') || ' ' || body));

CREATE TRIGGER trg_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 17. COMMUNITY_REPLIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS community_replies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID        NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_reply_id UUID        REFERENCES community_replies(id) ON DELETE SET NULL,
  -- NULL = top-level reply; set = nested reply (1 level deep max recommended)

  body            TEXT        NOT NULL,
  is_anonymous    BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Moderation
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','flagged','removed')),
  moderation      JSONB,

  -- Engagement
  like_count      INTEGER     NOT NULL DEFAULT 0,
  is_accepted     BOOLEAN     NOT NULL DEFAULT FALSE,  -- marked by OP as helpful

  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replies_post
  ON community_replies (post_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_replies_user
  ON community_replies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_pending
  ON community_replies (status, created_at) WHERE status = 'pending';

CREATE TRIGGER trg_community_replies_updated_at
  BEFORE UPDATE ON community_replies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 18. NOTIFICATIONS
-- =============================================================================
-- All scheduled and sent push notifications.

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type            TEXT        NOT NULL
                    CHECK (type IN (
                      'weekly_update','daily_tip','appointment_reminder',
                      'kick_reminder','medication_reminder','community_reply',
                      'symptom_followup','mood_checkin','weight_checkin',
                      'ppd_resource','emergency_followup','postpartum_update'
                    )),
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  data            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Deep-link data: { "screen": "tracking", "tab": "kick" }

  -- Scheduling
  scheduled_for   TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','sent','failed','cancelled')),
  failure_reason  TEXT,

  -- Engagement
  opened_at       TIMESTAMPTZ,
  action_taken    TEXT,

  -- Source reference
  source_type     TEXT,   -- "appointment", "medication_reminder", etc.
  source_id       UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user_scheduled
  ON notifications (user_id, scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_notifs_scheduled_for
  ON notifications (scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_notifs_user_sent
  ON notifications (user_id, sent_at DESC) WHERE status = 'sent';

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 19. POSTPARTUM_PROFILES
-- =============================================================================
-- Activated when user logs birth or passes week 40.
-- Tracks recovery and newborn simultaneously.

CREATE TABLE IF NOT EXISTS postpartum_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id        UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  birth_date          DATE        NOT NULL,
  birth_type          TEXT        CHECK (birth_type IN ('vaginal', 'c_section', 'vbac', 'assisted')),
  feeding_method      TEXT        NOT NULL DEFAULT 'unknown'
                        CHECK (feeding_method IN ('breastfeeding','formula','mixed','unknown')),

  -- Recovery tracking
  c_section_incision_ok BOOLEAN,
  perineal_healing_ok   BOOLEAN,
  lochia_stopped_at     DATE,

  -- Newborn basics
  baby_name           TEXT,
  baby_sex            TEXT        CHECK (baby_sex IN ('male','female','intersex','unknown')),
  birth_weight_grams  INTEGER,
  birth_length_cm     NUMERIC(5,2),

  -- PPD tracking state
  ppd_screen_due_at   TIMESTAMPTZ,   -- next scheduled EPDS
  ppd_last_score      SMALLINT,
  ppd_high_risk       BOOLEAN     NOT NULL DEFAULT FALSE,

  -- App mode
  current_baby_week   SMALLINT    NOT NULL DEFAULT 0,
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postpartum_user
  ON postpartum_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_postpartum_ppd
  ON postpartum_profiles (ppd_high_risk) WHERE ppd_high_risk = TRUE;

CREATE TRIGGER trg_postpartum_profiles_updated_at
  BEFORE UPDATE ON postpartum_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 20. NEWBORN_LOGS
-- =============================================================================
-- Feeding, sleep, and diaper logs for the newborn phase.

CREATE TABLE IF NOT EXISTS newborn_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  postpartum_id       UUID        NOT NULL REFERENCES postpartum_profiles(id) ON DELETE CASCADE,

  log_type            TEXT        NOT NULL
                        CHECK (log_type IN ('feeding','sleep','diaper','growth','other')),

  baby_age_days       INTEGER,   -- denormalised for easy querying

  -- Feeding fields
  feeding_type        TEXT        CHECK (feeding_type IN ('breast_left','breast_right','both_breasts','formula','pumped')),
  feeding_duration_min SMALLINT,
  feeding_amount_ml   NUMERIC(6,2),

  -- Sleep fields
  sleep_start         TIMESTAMPTZ,
  sleep_end           TIMESTAMPTZ,
  sleep_duration_min  SMALLINT,
  sleep_location      TEXT        CHECK (sleep_location IN ('crib','bassinet','parent_bed','carrier','stroller','other')),
  sleep_position      TEXT        CHECK (sleep_position IN ('back','side','tummy')),

  -- Diaper fields
  diaper_type         TEXT        CHECK (diaper_type IN ('wet','dirty','both','dry')),
  stool_color         TEXT        CHECK (stool_color IN ('black','dark_green','yellow','green','red','white','orange')),
  stool_consistency   TEXT        CHECK (stool_consistency IN ('meconium','seedy','watery','soft','hard')),

  -- Growth fields (periodic)
  weight_grams        INTEGER,
  length_cm           NUMERIC(5,2),
  head_circumference_cm NUMERIC(5,2),

  notes               TEXT,
  logged_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newborn_logs_user
  ON newborn_logs (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_newborn_logs_postpartum
  ON newborn_logs (postpartum_id, log_type, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_newborn_logs_type_time
  ON newborn_logs (user_id, log_type, logged_at DESC);


-- =============================================================================
-- 21. BABY_NAMES_SHORTLIST
-- =============================================================================
-- Names suggested by AI or added manually, with user reactions.

CREATE TABLE IF NOT EXISTS baby_names_shortlist (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pregnancy_id    UUID        REFERENCES pregnancies(id) ON DELETE SET NULL,

  name            TEXT        NOT NULL,
  gender_fit      TEXT        CHECK (gender_fit IN ('boy','girl','neutral','any')),
  origin          TEXT,       -- "Arabic", "Hebrew", "Celtic", "Latin", etc.
  meaning         TEXT,
  pronunciation   TEXT,       -- IPA or phonetic: "FAH-tih-mah"
  syllables       SMALLINT,
  popularity_rank INTEGER,    -- global rank if known

  -- AI-generated extras
  sibling_names   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  middle_names    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  cultural_notes  TEXT,

  -- User reaction
  status          TEXT        NOT NULL DEFAULT 'saved'
                    CHECK (status IN ('saved','loved','vetoed','maybe')),
  partner_status  TEXT        CHECK (partner_status IN ('loved','vetoed','maybe','pending')),
  shared_with_partner BOOLEAN NOT NULL DEFAULT FALSE,

  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_names_user
  ON baby_names_shortlist (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_names_loved
  ON baby_names_shortlist (user_id) WHERE status = 'loved' AND deleted_at IS NULL;

CREATE TRIGGER trg_baby_names_updated_at
  BEFORE UPDATE ON baby_names_shortlist
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 22. EMERGENCY_RESOURCES  (build-time cached, no FK to users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS emergency_resources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country             TEXT        NOT NULL,
  language            TEXT        NOT NULL DEFAULT 'en',
  emergency_number    TEXT        NOT NULL,
  ambulance_number    TEXT,
  mental_health_line  TEXT,
  resources           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "name": "...", "contact": "...", "url": "...", "hours": "24/7" }]
  last_verified_at    DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country, language)
);

CREATE INDEX IF NOT EXISTS idx_emergency_country
  ON emergency_resources (country, language);

CREATE TRIGGER trg_emergency_resources_updated_at
  BEFORE UPDATE ON emergency_resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 23. PUSH_NOTIFICATION_COPY  (build-time cached templates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_notification_copy (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week        SMALLINT    NOT NULL,
  phase       TEXT        NOT NULL DEFAULT 'pregnancy'
                CHECK (phase IN ('pregnancy', 'newborn')),
  language    TEXT        NOT NULL DEFAULT 'en',
  category    TEXT        NOT NULL DEFAULT 'weekly',
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week, phase, language, category)
);

CREATE INDEX IF NOT EXISTS idx_push_copy_lookup
  ON push_notification_copy (week, phase, language);


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
