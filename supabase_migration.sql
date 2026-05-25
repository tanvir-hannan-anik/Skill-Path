-- SkillPath: run this once in Supabase Dashboard → SQL Editor
-- Creates tables for Knowledge Check and Daily Task persistence

-- -------------------------------------------------------
-- knowledge_checks
-- Stores AI-generated quiz questions + student answers
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_checks (
  id            TEXT PRIMARY KEY,           -- uid_wsId_date
  user_id       TEXT NOT NULL,
  workspace_id  TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL,              -- YYYY-MM-DD
  data          JSONB NOT NULL DEFAULT '{}',-- { topic, questions, answers, score, generatedAt, completedAt }
  generated_at  BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kc_user_date
  ON public.knowledge_checks (user_id, date);

-- Enable Row Level Security (same pattern as other tables)
ALTER TABLE public.knowledge_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own knowledge checks"
  ON public.knowledge_checks
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- -------------------------------------------------------
-- daily_tasks
-- Stores AI-generated daily tasks + completion state
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id            TEXT PRIMARY KEY,           -- uid_wsId_date
  user_id       TEXT NOT NULL,
  workspace_id  TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL,              -- YYYY-MM-DD
  data          JSONB NOT NULL DEFAULT '{}',-- { tasks, doneIds, generatedAt }
  generated_at  BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_user_date
  ON public.daily_tasks (user_id, date);

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily tasks"
  ON public.daily_tasks
  FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
