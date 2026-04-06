-- =============================================================================
-- POSTLY — Setup completo (merged)
-- Generado desde 9 archivos SQL individuales
-- Ejecuta este archivo en: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ========================================
-- Schema: schema.sql
-- ========================================

-- =============================================================================
-- POSTLY — Supabase Schema
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Brands ───────────────────────────────────────────────────────────────────
create table if not exists public.brands (
  id                     uuid primary key default uuid_generate_v4(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  name                   text not null,
  sector                 text,
  tone                   text,
  colors                 jsonb,
  fonts                  jsonb,
  slogans                text[]    default '{}',
  hashtags               text[]    default '{}',
  location               text,
  services               text[]    default '{}',
  faq                    jsonb,
  brand_voice_doc        text,
  ig_account_id          text,
  fb_page_id             text,
  ig_access_token        text,
  fb_access_token        text,
  auto_publish           boolean   default false,
  publish_mode           text      default 'manual',
  rules                  jsonb,
  plan                   text      default 'starter',
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);

alter table public.brands enable row level security;

DROP POLICY IF EXISTS "brands: owner full access" ON public.brands;
create policy "brands: owner full access"
  on public.brands for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Posts ────────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id               uuid primary key default uuid_generate_v4(),
  brand_id         uuid not null references public.brands(id) on delete cascade,
  image_url        text,
  edited_image_url text,
  caption          text,
  hashtags         text[]    default '{}',
  edit_level       integer   default 0,
  format           text      default 'image',
  platform         text[]    default '{"instagram"}',
  status           text      default 'draft',
  scheduled_at     timestamptz,
  published_at     timestamptz,
  ig_post_id       text,
  fb_post_id       text,
  ai_explanation   text,
  quality_score    numeric,
  versions         jsonb     default '[]',
  created_by       text,
  approved_by      text,
  goal             text,
  created_at       timestamptz default now()
);

alter table public.posts enable row level security;

DROP POLICY IF EXISTS "posts: brand owner access" ON public.posts;
create policy "posts: brand owner access"
  on public.posts for all
  using (
    exists (
      select 1 from public.brands
      where brands.id = posts.brand_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = posts.brand_id
        and brands.user_id = auth.uid()
    )
  );

-- ─── Comments ─────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete set null,
  platform    text not null,
  external_id text not null,
  author      text not null,
  content     text not null,
  sentiment   text,
  ai_reply    text,
  status      text default 'pending',
  created_at  timestamptz default now()
);

alter table public.comments enable row level security;

DROP POLICY IF EXISTS "comments: brand owner access" ON public.comments;
create policy "comments: brand owner access"
  on public.comments for all
  using (
    exists (
      select 1 from public.brands
      where brands.id = comments.brand_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = comments.brand_id
        and brands.user_id = auth.uid()
    )
  );

-- ─── Notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  brand_id   uuid not null references public.brands(id) on delete cascade,
  type       text not null,
  message    text not null,
  read       boolean default false,
  metadata   jsonb,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

DROP POLICY IF EXISTS "notifications: brand owner access" ON public.notifications;
create policy "notifications: brand owner access"
  on public.notifications for all
  using (
    exists (
      select 1 from public.brands
      where brands.id = notifications.brand_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = notifications.brand_id
        and brands.user_id = auth.uid()
    )
  );

-- ─── Activity Log ─────────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  user_id     uuid not null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz default now()
);

alter table public.activity_log enable row level security;

DROP POLICY IF EXISTS "activity_log: brand owner access" ON public.activity_log;
create policy "activity_log: brand owner access"
  on public.activity_log for all
  using (
    exists (
      select 1 from public.brands
      where brands.id = activity_log.brand_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = activity_log.brand_id
        and brands.user_id = auth.uid()
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_brands_user_id       on public.brands(user_id);
create index if not exists idx_posts_brand_id       on public.posts(brand_id);
create index if not exists idx_posts_status         on public.posts(status);
create index if not exists idx_posts_scheduled_at   on public.posts(scheduled_at);
create index if not exists idx_comments_brand_id    on public.comments(brand_id);
create index if not exists idx_notifications_brand  on public.notifications(brand_id);
create index if not exists idx_notifications_read   on public.notifications(brand_id, read);


-- ========================================
-- Schema: schema_additions.sql
-- ========================================

-- =============================================================================
-- POSTLY — Schema additions
-- Ejecuta en Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  avatar_url  text,
  timezone    text default 'Europe/Madrid',
  language    text default 'es',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

DROP POLICY IF EXISTS "profiles: own record" ON public.profiles;
create policy "profiles: own record"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── Team Members ─────────────────────────────────────────────────────────────
create table if not exists public.team_members (
  id             uuid default gen_random_uuid() primary key,
  brand_id       uuid references public.brands(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  invited_email  text,
  role           text not null,       -- 'admin'|'editor'|'approver'|'analyst'
  status         text default 'pending', -- 'pending'|'active'
  invite_token   text unique,
  created_at     timestamptz default now()
);

alter table public.team_members enable row level security;

DROP POLICY IF EXISTS "team_members: brand owner and members" ON public.team_members;
create policy "team_members: brand owner and members"
  on public.team_members for all
  using (
    brand_id in (select id from public.brands where user_id = auth.uid())
    or user_id = auth.uid()
  )
  with check (
    brand_id in (select id from public.brands where user_id = auth.uid())
  );

create index if not exists idx_team_members_brand_id on public.team_members(brand_id);
create index if not exists idx_team_members_invite_token on public.team_members(invite_token);

-- ─── ALTER brands — new columns ────────────────────────────────────────────────
alter table public.brands add column if not exists meta_token_expires_at timestamptz;
alter table public.brands add column if not exists ig_username            text;
alter table public.brands add column if not exists fb_page_name           text;
alter table public.brands add column if not exists plan_started_at        timestamptz;
alter table public.brands add column if not exists trial_ends_at          timestamptz;
alter table public.brands add column if not exists plan_cancels_at        timestamptz;
alter table public.brands add column if not exists notify_email_publish   boolean default false;
alter table public.brands add column if not exists notify_email_comments  boolean default true;

-- ─── ALTER posts — metrics column ─────────────────────────────────────────────
alter table public.posts add column if not exists metrics jsonb default '{}';

-- ─── Additional notification types are text, no schema change needed ──────────


-- ========================================
-- Schema: schema_admin.sql
-- ========================================

-- =============================================================================
-- POSTLY — Admin Panel Schema
-- Ejecuta en Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ─── Add role to profiles ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
-- role: 'user' | 'superadmin'

-- Helper function for RLS policies
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Prospects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_account_id   text,
  username        text,
  full_name       text,
  profile_pic_url text,
  bio             text,
  followers       int  DEFAULT 0,
  following       int  DEFAULT 0,
  post_count      int  DEFAULT 0,
  sector          text,
  city            text,
  email           text,
  website         text,
  channel         text DEFAULT 'instagram',  -- 'instagram'|'email'|'meta_ads'
  status          text DEFAULT 'contacted',  -- 'contacted'|'replied'|'interested'|'converted'|'not_interested'
  notes           text,
  last_activity   timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prospects: superadmin only" ON public.prospects;
CREATE POLICY "prospects: superadmin only"
  ON public.prospects FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_prospects_status   ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_channel  ON public.prospects(channel);
CREATE INDEX IF NOT EXISTS idx_prospects_username ON public.prospects(username);

-- ─── Outbound comments (comments Postly sends on prospects' IG posts) ─────────
CREATE TABLE IF NOT EXISTS public.outbound_comments (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id               uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  ig_post_url               text,
  ig_post_id                text,
  comment_ig_id             text,           -- our comment's ID returned by IG
  content                   text NOT NULL,
  prospect_reply            text,
  prospect_reply_id         text,
  prospect_reply_liked      boolean DEFAULT false,
  prospect_reply_liked_at   timestamptz,
  status                    text DEFAULT 'sent',  -- 'sent'|'replied'|'ignored'
  sent_at                   timestamptz DEFAULT now(),
  replied_at                timestamptz
);

ALTER TABLE public.outbound_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outbound_comments: superadmin only" ON public.outbound_comments;
CREATE POLICY "outbound_comments: superadmin only"
  ON public.outbound_comments FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_outbound_comments_prospect ON public.outbound_comments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outbound_comments_status   ON public.outbound_comments(status);

-- ─── Messages (DMs and emails received from prospects) ────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform            text DEFAULT 'instagram',   -- 'instagram'|'facebook'|'email'
  external_id         text UNIQUE,
  thread_id           text,
  sender_username     text,
  sender_id           text,
  content             text,
  our_reply           text,
  status              text DEFAULT 'unread',       -- 'unread'|'read'|'replied'|'archived'
  ai_reply_suggestion text,
  prospect_id         uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  replied_at          timestamptz
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages: superadmin only" ON public.messages;
CREATE POLICY "messages: superadmin only"
  ON public.messages FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_messages_platform   ON public.messages(platform);
CREATE INDEX IF NOT EXISTS idx_messages_status     ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id  ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_prospect   ON public.messages(prospect_id);

-- ─── Prospect interactions (full timeline) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospect_interactions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id  uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  type         text NOT NULL,
  -- 'comment_sent'|'comment_reply_received'|'email_sent'|'email_opened'
  -- 'email_replied'|'dm_received'|'dm_sent'|'status_changed'|'ad_lead'|'note_added'
  content      text,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.prospect_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interactions: superadmin only" ON public.prospect_interactions;
CREATE POLICY "interactions: superadmin only"
  ON public.prospect_interactions FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_interactions_prospect ON public.prospect_interactions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type     ON public.prospect_interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created  ON public.prospect_interactions(created_at DESC);

-- ─── Enable Realtime for activity feed ────────────────────────────────────────
-- Run in Supabase Dashboard → Database → Replication → Add tables:
-- prospects, messages, prospect_interactions


-- ========================================
-- Schema: schema_agents_advanced.sql
-- ========================================

-- =============================================================================
-- POSTLY — Advanced Agents Schema
-- Trends, Seasonal, Competitor, Churn
-- =============================================================================

-- ─── Trends ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trends (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sector      text NOT NULL,
  title       text,
  format      text,
  description text,
  viral_score int,
  expires_in  text,
  hashtags    text[],
  week_of     date,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_trends (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id            uuid REFERENCES brands(id) ON DELETE CASCADE,
  trend_id            uuid REFERENCES trends(id),
  adapted_caption     text,
  adapted_hashtags    text[],
  visual_instructions text,
  urgency             text,
  status              text DEFAULT 'suggested',
  -- 'suggested' | 'used' | 'ignored'
  post_id             uuid REFERENCES posts(id),
  created_at          timestamptz DEFAULT now()
);

-- ─── Seasonal ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_dates (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  date_type    text,        -- 'fixed' | 'variable' | 'seasonal'
  month        int,
  day          int,         -- null if variable
  sectors      text[],      -- which sectors this applies to
  priority     text,        -- 'high' | 'medium' | 'low'
  days_advance int,         -- how many days in advance to prepare
  created_at   timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO seasonal_dates (name, date_type, month, day, sectors, priority, days_advance) VALUES
  ('Año Nuevo',           'fixed',    1,  1,  ARRAY['all'],                                           'high',   7),
  ('Reyes Magos',         'fixed',    1,  6,  ARRAY['all'],                                           'high',   7),
  ('Rebajas de enero',    'fixed',    1,  7,  ARRAY['boutique','moda'],                               'high',   3),
  ('Día de la Pizza',     'fixed',    2,  9,  ARRAY['restaurante','cafeteria'],                       'medium', 3),
  ('San Valentín',        'fixed',    2,  14, ARRAY['all'],                                           'high',   7),
  ('Operación bikini',    'seasonal', 3,  1,  ARRAY['gym','clinica'],                                 'high',   3),
  ('Nueva col P/V',       'fixed',    2,  15, ARRAY['boutique','moda'],                               'high',   5),
  ('Semana Santa',        'variable', NULL, NULL, ARRAY['all'],                                       'high',   7),
  ('Día del Trabajador',  'fixed',    5,  1,  ARRAY['all'],                                           'medium', 3),
  ('Inicio verano',       'seasonal', 6,  1,  ARRAY['all'],                                           'high',   5),
  ('Día del Helado',      'fixed',    7,  7,  ARRAY['heladeria'],                                     'high',   3),
  ('Rebajas de julio',    'fixed',    7,  1,  ARRAY['boutique','moda'],                               'high',   3),
  ('San Juan',            'fixed',    6,  24, ARRAY['restaurante','heladeria','cafeteria'],            'medium', 3),
  ('Asunción',            'fixed',    8,  15, ARRAY['all'],                                           'low',    1),
  ('Nueva col O/I',       'fixed',    8,  15, ARRAY['boutique','moda'],                               'high',   5),
  ('Vuelta al cole',      'seasonal', 9,  1,  ARRAY['gym','clinica','boutique'],                      'high',   5),
  ('Día del Café',        'fixed',    10, 1,  ARRAY['cafeteria','restaurante'],                       'medium', 3),
  ('Halloween',           'fixed',    10, 31, ARRAY['all'],                                           'medium', 5),
  ('Día Hispanidad',      'fixed',    10, 12, ARRAY['all'],                                           'low',    1),
  ('Todos los Santos',    'fixed',    11, 1,  ARRAY['all'],                                           'low',    1),
  ('Black Friday',        'variable', NULL, NULL, ARRAY['all'],                                       'high',   7),
  ('Inicio Navidad',      'seasonal', 12, 1,  ARRAY['all'],                                           'high',   5),
  ('Constitución',        'fixed',    12, 6,  ARRAY['all'],                                           'low',    1),
  ('Lotería de Navidad',  'fixed',    12, 22, ARRAY['all'],                                           'medium', 3),
  ('Navidad',             'fixed',    12, 25, ARRAY['all'],                                           'high',   7),
  ('Nochevieja',          'fixed',    12, 31, ARRAY['all'],                                           'high',   5)
ON CONFLICT DO NOTHING;

-- ─── Competitor Analysis ─────────────────────────────────────────────────────

ALTER TABLE brands ADD COLUMN IF NOT EXISTS competitors text[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS competitor_analysis (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id            uuid REFERENCES brands(id) ON DELETE CASCADE,
  competitor_username text,
  followers_count     int,
  avg_engagement      numeric,
  top_formats         jsonb,
  top_topics          jsonb,
  posting_frequency   text,
  strengths           jsonb,
  weaknesses          jsonb,
  opportunity_gaps    text,
  content_ideas       jsonb,
  analyzed_at         timestamptz DEFAULT now()
);

-- ─── Churn ───────────────────────────────────────────────────────────────────

ALTER TABLE brands ADD COLUMN IF NOT EXISTS churn_score           int DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS churn_risk            text DEFAULT 'low';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS last_login_at         timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS last_post_published_at timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS rejected_in_a_row     int DEFAULT 0;

CREATE TABLE IF NOT EXISTS churn_actions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id             uuid REFERENCES brands(id) ON DELETE CASCADE,
  action_type          text,
  -- 'email_medium' | 'email_high' | 'email_critical' | 'manual_call' | 'discount_offered'
  churn_score_at_action int,
  email_subject        text,
  email_body           text,
  discount_code        text,
  result               text DEFAULT 'pending',
  -- 'no_response' | 'reactivated' | 'cancelled' | 'pending'
  created_at           timestamptz DEFAULT now(),
  resolved_at          timestamptz
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trends_sector_week   ON trends (sector, week_of);
CREATE INDEX IF NOT EXISTS idx_brand_trends_brand   ON brand_trends (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_comp_analysis_brand  ON competitor_analysis (brand_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_churn_actions_brand  ON churn_actions (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brands_churn_risk    ON brands (churn_risk, churn_score);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE trends              ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_trends        ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_actions       ENABLE ROW LEVEL SECURITY;

-- brand_trends: owner can read their own
DROP POLICY IF EXISTS "brand_trends_select" ON brand_trends;
CREATE POLICY "brand_trends_select" ON brand_trends FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "brand_trends_update" ON brand_trends;
CREATE POLICY "brand_trends_update" ON brand_trends FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- competitor_analysis: owner can read
DROP POLICY IF EXISTS "comp_analysis_select" ON competitor_analysis;
CREATE POLICY "comp_analysis_select" ON competitor_analysis FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- trends: anyone authenticated can read
DROP POLICY IF EXISTS "trends_select" ON trends;
CREATE POLICY "trends_select" ON trends FOR SELECT USING (auth.uid() IS NOT NULL);

-- churn_actions: superadmin only (via service role)
DROP POLICY IF EXISTS "churn_actions_select" ON churn_actions;
CREATE POLICY "churn_actions_select" ON churn_actions FOR SELECT USING (is_superadmin());


-- ========================================
-- Schema: schema_phase3.sql
-- ========================================

-- =============================================================================
-- POSTLY — Phase 3 Schema Additions
-- Run after: schema.sql, schema_additions.sql, schema_admin.sql, schema_agents_advanced.sql
-- =============================================================================

-- ─── Ensure brands has all Phase 3 columns ───────────────────────────────────

-- slogans array (already in Brand type, ensure column exists)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS slogans TEXT[] DEFAULT '{}';

-- colors jsonb (brand colors from onboarding)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT NULL;

-- fonts jsonb (brand typography)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS fonts JSONB DEFAULT NULL;

-- faq jsonb array (FAQ entries)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT NULL;

-- publish_mode enum (already in type, ensure it's there)
DO $$ BEGIN
  CREATE TYPE publish_mode_type AS ENUM ('manual', 'semi', 'auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE brands ADD COLUMN IF NOT EXISTS publish_mode TEXT NOT NULL DEFAULT 'manual'
  CHECK (publish_mode IN ('manual', 'semi', 'auto'));

-- ─── Posts: ensure versions column exists ───────────────────────────────────
-- versions is a JSONB array of { caption, hashtags, savedAt }
ALTER TABLE posts ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]';

-- ai_explanation column (ensure exists)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS ai_explanation TEXT DEFAULT NULL;

-- ─── Activity log: ensure table exists ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID        DEFAULT NULL,
  details     JSONB       DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own brand activity" ON activity_log;
CREATE POLICY "Users see own brand activity" ON activity_log
  FOR SELECT USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users insert own brand activity" ON activity_log;
CREATE POLICY "Users insert own brand activity" ON activity_log
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS activity_log_brand_id_idx ON activity_log(brand_id, created_at DESC);

-- ─── Notifications: add missing types ────────────────────────────────────────
-- notification_type enum may need additional values; use text if already text
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'meta_connected';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'token_expired';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'plan_activated';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'team_invite';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trend_detected';
EXCEPTION WHEN others THEN NULL; END $$;

-- ─── Posts: add edit_level column ────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edit_level SMALLINT NOT NULL DEFAULT 0 CHECK (edit_level IN (0, 1, 2));

-- ─── Posts: add metrics jsonb ────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT NULL;

-- ─── Indexes for performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS posts_brand_status_idx   ON posts(brand_id, status);
CREATE INDEX IF NOT EXISTS posts_brand_created_idx  ON posts(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifs_brand_read_idx    ON notifications(brand_id, read, created_at DESC);


-- ========================================
-- Schema: worker-schema.sql
-- ========================================

-- NeuroPost Worker Portal — Database Schema
-- Run this in your Supabase SQL editor

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  full_name text,
  email text,
  role text DEFAULT 'worker' CHECK (role IN ('worker', 'senior', 'admin')),
  avatar_url text,
  is_active boolean DEFAULT true,
  brands_assigned uuid[] DEFAULT '{}',
  specialties text[] DEFAULT '{}',
  notes text,
  joined_at timestamptz DEFAULT now()
);

-- Content validation queue
CREATE TABLE IF NOT EXISTS content_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  type text DEFAULT 'ai_proposal' CHECK (type IN ('edit_request', 'ai_proposal', 'direct')),
  status text DEFAULT 'pending_worker' CHECK (status IN (
    'pending_worker', 'worker_approved', 'worker_rejected',
    'sent_to_client', 'client_approved', 'client_rejected'
  )),
  assigned_worker_id uuid REFERENCES workers(id),
  worker_notes text,
  worker_reviewed_at timestamptz,
  client_feedback text,
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  regeneration_count int DEFAULT 0,
  regeneration_history jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Feed ordering queue
CREATE TABLE IF NOT EXISTS feed_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id),
  image_url text,
  position int NOT NULL DEFAULT 0,
  is_published boolean DEFAULT false,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Internal client notes (worker-only)
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES workers(id),
  note text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Internal team messages
CREATE TABLE IF NOT EXISTS worker_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id),
  from_worker_id uuid REFERENCES workers(id),
  to_worker_id uuid REFERENCES workers(id),
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Client activity log (visible to workers)
CREATE TABLE IF NOT EXISTS client_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Extend posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS requires_worker_validation boolean DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_edit_mode text DEFAULT 'proposal' CHECK (client_edit_mode IN ('proposal', 'instant'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_notes_for_worker text;

-- RLS policies (workers see their assigned brands)
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;

-- Workers can see all content (service role bypasses RLS in API routes)
-- Brand owners can see their own feed queue
DROP POLICY IF EXISTS "Brand owners can read their feed_queue" ON feed_queue;
CREATE POLICY "Brand owners can read their feed_queue"
  ON feed_queue FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Brand owners can update their feed_queue" ON feed_queue;
CREATE POLICY "Brand owners can update their feed_queue"
  ON feed_queue FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_brand ON content_queue(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_worker ON content_queue(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_feed_queue_brand ON feed_queue(brand_id, position);
CREATE INDEX IF NOT EXISTS idx_client_activity_brand ON client_activity_log(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_messages_to ON worker_messages(to_worker_id, read);


-- ========================================
-- Schema: features-schema.sql
-- ========================================

-- Chat client <-> worker
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  sender_type text, -- 'client' | 'worker'
  message text,
  attachments jsonb DEFAULT '[]',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Special requests
CREATE TABLE IF NOT EXISTS special_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text, -- 'campaign' | 'seasonal' | 'custom' | 'urgent' | 'consultation' | 'other'
  status text DEFAULT 'pending', -- 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected'
  assigned_worker_id uuid REFERENCES workers(id),
  worker_response text,
  deadline_at timestamptz,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Onboarding progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE UNIQUE,
  steps_completed text[] DEFAULT '{}',
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text,
  category text, -- 'billing' | 'technical' | 'instagram' | 'content' | 'account' | 'other'
  priority text DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
  status text DEFAULT 'open', -- 'open' | 'in_progress' | 'resolved' | 'closed'
  assigned_worker_id uuid REFERENCES workers(id),
  resolution text,
  satisfaction_rating integer, -- 1-5
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  sender_type text, -- 'client' | 'worker'
  message text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own chat" ON chat_messages;
CREATE POLICY "Own chat" ON chat_messages FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Own requests" ON special_requests;
CREATE POLICY "Own requests" ON special_requests FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Own onboarding" ON onboarding_progress;
CREATE POLICY "Own onboarding" ON onboarding_progress FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Own tickets" ON support_tickets;
CREATE POLICY "Own tickets" ON support_tickets FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Own ticket messages" ON support_ticket_messages;
CREATE POLICY "Own ticket messages" ON support_ticket_messages FOR ALL
  USING (ticket_id IN (
    SELECT id FROM support_tickets WHERE brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_brand_id ON chat_messages(brand_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_requests_brand_id ON special_requests(brand_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_brand_id ON support_tickets(brand_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);


-- ========================================
-- Schema: inspiration-schema.sql
-- ========================================

-- Referencias de inspiración guardadas por el cliente
CREATE TABLE IF NOT EXISTS inspiration_references (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  type text,
  -- 'url' | 'upload' | 'template'
  source_url text,
  thumbnail_url text,
  title text,
  notes text,
  sector text,
  style_tags text[],
  format text,
  -- 'image' | 'reel' | 'carousel' | 'story'
  is_saved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Solicitudes de recreación
CREATE TABLE IF NOT EXISTS recreation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  reference_id uuid REFERENCES inspiration_references(id),
  post_id uuid REFERENCES posts(id),
  client_notes text,
  style_to_adapt text[],
  status text DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'completed' | 'rejected'
  worker_notes text,
  created_at timestamptz DEFAULT now()
);

-- Plantillas de NeuroPost por sector
CREATE TABLE IF NOT EXISTS inspiration_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  sectors text[],
  styles text[],
  format text,
  prompt_template text,
  tags text[],
  is_active boolean DEFAULT true,
  times_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inspiration_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE recreation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own inspirations" ON inspiration_references;
CREATE POLICY "Own inspirations" ON inspiration_references
  FOR ALL
  USING (brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Own recreations" ON recreation_requests;
CREATE POLICY "Own recreations" ON recreation_requests
  FOR ALL
  USING (brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS inspiration_references_brand_id_idx ON inspiration_references(brand_id);
CREATE INDEX IF NOT EXISTS recreation_requests_brand_id_idx ON recreation_requests(brand_id);
CREATE INDEX IF NOT EXISTS recreation_requests_status_idx ON recreation_requests(status);
CREATE INDEX IF NOT EXISTS inspiration_templates_is_active_idx ON inspiration_templates(is_active);


-- ========================================
-- Schema: status-changelog-schema.sql
-- ========================================

-- Service incidents
CREATE TABLE IF NOT EXISTS service_incidents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'minor', -- 'minor' | 'major' | 'critical'
  status text DEFAULT 'investigating', -- 'investigating' | 'identified' | 'monitoring' | 'resolved'
  affected_services text[] DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid REFERENCES service_incidents(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  confirmed boolean DEFAULT true,
  confirm_token text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text,
  title text NOT NULL,
  summary text,
  changes jsonb DEFAULT '[]', -- [{type:'new'|'improved'|'fixed'|'removed', text:'...'}]
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON service_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON service_incidents(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog_entries(is_published, published_at DESC);
