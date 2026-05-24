-- SkillPath Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- Enable RLS (Row Level Security) on all tables so users can only access their own data.

-- ---- Profiles ---------------------------------------------------------------
create table if not exists profiles (
  id            text primary key,           -- Firebase UID
  active_workspace_id text,
  updated_at    timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile"
  on profiles for all using (id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Workspaces -------------------------------------------------------------
create table if not exists workspaces (
  id            text not null,
  user_id       text not null,
  name          text not null,
  color         text not null,
  level         text,
  hours_per_day integer,
  created_at    bigint not null,
  primary key (id, user_id)
);
alter table workspaces enable row level security;
create policy "Users manage own workspaces"
  on workspaces for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Workspace schedules ----------------------------------------------------
create table if not exists workspace_schedules (
  user_id       text not null,
  workspace_id  text not null,
  days          jsonb not null default '{}',
  updated_at    timestamptz default now(),
  primary key (user_id, workspace_id)
);
alter table workspace_schedules enable row level security;
create policy "Users manage own schedules"
  on workspace_schedules for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Chat messages ----------------------------------------------------------
create table if not exists chat_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  role          text not null check (role in ('ai', 'user')),
  text          text not null,
  created_at    timestamptz default now()
);
create index if not exists chat_messages_user_created on chat_messages (user_id, created_at asc);
alter table chat_messages enable row level security;
create policy "Users manage own chat"
  on chat_messages for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Study packs ------------------------------------------------------------
create table if not exists study_packs (
  id            text not null,
  user_id       text not null,
  data          jsonb not null default '{}',
  primary key (id, user_id)
);
alter table study_packs enable row level security;
create policy "Users manage own study packs"
  on study_packs for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Saved docs -------------------------------------------------------------
create table if not exists saved_docs (
  id            text not null,
  user_id       text not null,
  data          jsonb not null default '{}',
  saved_at      bigint not null,
  primary key (id, user_id)
);
alter table saved_docs enable row level security;
create policy "Users manage own saved docs"
  on saved_docs for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Video plans ------------------------------------------------------------
create table if not exists video_plans (
  video_id      text not null,
  user_id       text not null,
  data          jsonb not null default '{}',
  primary key (video_id, user_id)
);
alter table video_plans enable row level security;
create policy "Users manage own video plans"
  on video_plans for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ---- Weekly assignments -----------------------------------------------------
create table if not exists weekly_assignments (
  week_key      text not null,
  user_id       text not null,
  data          jsonb not null default '{}',
  primary key (week_key, user_id)
);
alter table weekly_assignments enable row level security;
create policy "Users manage own weekly assignments"
  on weekly_assignments for all using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
