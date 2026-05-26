-- ============================================
-- Clarity — Shared Database Schema (source of truth)
-- Run this in Supabase SQL Editor to initialize
-- ============================================

CREATE SCHEMA IF NOT EXISTS app;

-- ============================================
-- 1. Profiles (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS app.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;

-- [SECURITY FIX] Was USING (true) — any anon could enumerate all usernames.
-- Now scoped to the authenticated user's own row only.
CREATE POLICY "profiles_select" ON app.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON app.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON app.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. Subjects (pomodoro subjects)
-- ============================================
CREATE TABLE IF NOT EXISTS app.subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_hidden   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE app.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_select" ON app.subjects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "subjects_insert" ON app.subjects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subjects_update" ON app.subjects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "subjects_delete" ON app.subjects
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. Sessions (timer sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS app.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name  TEXT NOT NULL,
  date          DATE NOT NULL,
  minutes       REAL NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON app.sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_subject ON app.sessions(user_id, subject_name);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON app.sessions(user_id, updated_at);
ALTER TABLE app.sessions ADD CONSTRAINT sessions_user_subject_date_uniq UNIQUE (user_id, subject_name, date);

ALTER TABLE app.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select" ON app.sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert" ON app.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update" ON app.sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete" ON app.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. Tasks (todos)
-- ============================================
CREATE TABLE IF NOT EXISTS app.tasks (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  starred     BOOLEAN NOT NULL DEFAULT false,
  due_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON app.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert" ON app.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update" ON app.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tasks_delete" ON app.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. Notes
-- ============================================
CREATE TABLE IF NOT EXISTS app.notes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#ffffff',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select" ON app.notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notes_insert" ON app.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_update" ON app.notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notes_delete" ON app.notes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. Background Images
-- ============================================
CREATE TABLE IF NOT EXISTS app.backgrounds (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_name  TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, view_name)
);

ALTER TABLE app.backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backgrounds_select" ON app.backgrounds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "backgrounds_insert" ON app.backgrounds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "backgrounds_update" ON app.backgrounds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "backgrounds_delete" ON app.backgrounds
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. User Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS app.user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_minutes         INTEGER NOT NULL DEFAULT 25,
  short_break_minutes   INTEGER NOT NULL DEFAULT 5,
  long_break_minutes    INTEGER NOT NULL DEFAULT 15,
  auto_start_breaks     BOOLEAN NOT NULL DEFAULT false,
  allow_long_timers     BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferences_select" ON app.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "preferences_insert" ON app.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "preferences_update" ON app.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- Trigger: auto-create profile + preferences on signup
-- [SECURITY FIX] Collision-resistant username generation —
-- retries up to 5 times appending a random 4-digit suffix.
-- ============================================
CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  attempt INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  final_username := base_username;

  LOOP
    BEGIN
      INSERT INTO app.profiles (id, username)
      VALUES (NEW.id, final_username);
      EXIT; -- success, leave loop
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      final_username := base_username || '_' || floor(random() * 9000 + 1000)::TEXT;
      IF attempt > 5 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO app.user_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();

-- ============================================
-- Grants & Permissions
-- [SECURITY FIX] Was GRANT ALL TO anon — now scoped to minimum required.
-- anon:          SELECT on profiles only (needed for public avatar lookup)
-- authenticated: full DML on their own rows (RLS enforces user_id ownership)
-- ============================================
GRANT USAGE ON SCHEMA app TO anon, authenticated;

-- anon can only read profiles (e.g. username for display)
GRANT SELECT ON app.profiles TO anon;

-- authenticated users get full DML — RLS policies enforce row ownership
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- ============================================
-- RPC: Atomic session upsert
-- [SECURITY FIX] Removed p_user_id parameter — was IDOR vulnerability.
-- Now uses auth.uid() internally so callers cannot write to other users' sessions.
-- ============================================
CREATE OR REPLACE FUNCTION app.upsert_session(
  p_subject_name TEXT,
  p_date DATE,
  p_minutes REAL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO app.sessions (user_id, subject_name, date, minutes)
  VALUES (auth.uid(), p_subject_name, p_date, p_minutes)
  ON CONFLICT (user_id, subject_name, date)
  DO UPDATE SET
    minutes = app.sessions.minutes + EXCLUDED.minutes,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- IMPORTANT: If you have an existing Supabase project, run these
-- ALTER statements to apply the security fixes to live policies:
-- ============================================

-- Fix profiles_select (was USING (true)):
-- DROP POLICY IF EXISTS "profiles_select" ON app.profiles;
-- CREATE POLICY "profiles_select" ON app.profiles FOR SELECT USING (auth.uid() = id);

-- Revoke over-broad anon grants:
-- REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon;
-- GRANT SELECT ON app.profiles TO anon;
