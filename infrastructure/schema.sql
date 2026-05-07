-- ============================================
-- Clarity v3 — App Schema + RLS
-- Compatible with v2 public schema for data migration
-- ============================================

CREATE SCHEMA IF NOT EXISTS app;

-- ============================================
-- 1. Profiles (extends auth.users)
-- ============================================
CREATE TABLE app.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON app.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert" ON app.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON app.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 2. Subjects (pomodoro subjects)
-- ============================================
CREATE TABLE app.subjects (
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
CREATE TABLE app.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name  TEXT NOT NULL,
  date          DATE NOT NULL,
  minutes       REAL NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_date ON app.sessions(user_id, date);
CREATE INDEX idx_sessions_user_subject ON app.sessions(user_id, subject_name);

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
CREATE TABLE app.tasks (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  starred     BOOLEAN NOT NULL DEFAULT false,
  due_date    DATE,
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
CREATE TABLE app.notes (
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
-- 6. Backgrounds (per-user view backgrounds)
-- ============================================
CREATE TABLE app.backgrounds (
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
-- 7. User Preferences (timer settings, etc.)
-- ============================================
CREATE TABLE app.user_preferences (
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
-- ============================================
CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));

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
-- Migration note: 
-- To migrate data from public.* to app.*, run:
--   INSERT INTO app.subjects   SELECT id, user_id, name, is_hidden, created_at FROM public.subjects;
--   INSERT INTO app.sessions   SELECT id, user_id, subject_name, date, minutes, created_at FROM public.sessions;
--   INSERT INTO app.tasks      SELECT id, user_id, text, done, starred, due_date, created_at, created_at FROM public.todos;
--   INSERT INTO app.notes      SELECT id, user_id, title, content, color, created_at, created_at FROM public.notes;
--   INSERT INTO app.profiles   SELECT id, username, full_name, NULL, created_at FROM public.profiles;
-- (Adjust column mappings as needed based on actual public schema)
-- ============================================
