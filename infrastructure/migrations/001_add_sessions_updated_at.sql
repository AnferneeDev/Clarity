-- ============================================
-- Migration: Add updated_at to sessions + update RPC
-- Run in Supabase SQL Editor
-- ============================================

-- 1. Add updated_at column to sessions
ALTER TABLE app.sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE app.sessions SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE app.sessions ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE app.sessions ALTER COLUMN updated_at SET DEFAULT now();

-- 2. Add index for offline sync queries
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON app.sessions(user_id, updated_at);

-- 3. Update the upsert_session RPC to track updated_at
CREATE OR REPLACE FUNCTION app.upsert_session(
  p_user_id UUID,
  p_subject_name TEXT,
  p_date DATE,
  p_minutes REAL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO app.sessions (user_id, subject_name, date, minutes)
  VALUES (p_user_id, p_subject_name, p_date, p_minutes)
  ON CONFLICT (user_id, subject_name, date)
  DO UPDATE SET
    minutes = app.sessions.minutes + EXCLUDED.minutes,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
