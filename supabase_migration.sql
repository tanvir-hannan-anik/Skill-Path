-- SkillPath: run this once in Supabase Dashboard → SQL Editor
-- Creates tables for Knowledge Check and Daily Task persistence

-- -------------------------------------------------------
-- knowledge_checks
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_checks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  workspace_id  TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  generated_at  BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kc_user_date
  ON public.knowledge_checks (user_id, date);

-- -------------------------------------------------------
-- daily_tasks
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  workspace_id  TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  generated_at  BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_user_date
  ON public.daily_tasks (user_id, date);

-- -------------------------------------------------------
-- FIX: Disable RLS — app uses Firebase Auth, not Supabase Auth.
-- Security is handled at the Firebase layer.
-- -------------------------------------------------------
ALTER TABLE public.knowledge_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks DISABLE ROW LEVEL SECURITY;

-- Drop the policies that blocked writes (they used auth.uid() = null)
DROP POLICY IF EXISTS "Users can manage their own knowledge checks" ON public.knowledge_checks;
DROP POLICY IF EXISTS "Users can manage their own daily tasks" ON public.daily_tasks;

-- Grant access to the anon role (same as weekly_assignments and other tables)
GRANT ALL ON public.knowledge_checks TO anon, authenticated;
GRANT ALL ON public.daily_tasks TO anon, authenticated;
