-- =============================================================================
-- POSTLY — Supabase Schema
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Brands ───────────────────────────────────────────────────────────────────
create table if not exists public.brands (
  id                             uuid primary key default uuid_generate_v4(),
  user_id                        uuid not null references auth.users(id) on delete cascade,
  name                           text not null,
  sector                         text,
  tone                           text,
  colors                         jsonb,
  fonts                          jsonb,
  slogans                        text[]    default '{}',
  hashtags                       text[]    default '{}',
  location                       text,
  services                       text[]    default '{}',
  faq                            jsonb,
  brand_voice_doc                text,
  ig_account_id                  text,
  fb_page_id                     text,
  ig_access_token                text,
  fb_access_token                text,
  auto_publish                   boolean   default false,
  publish_mode                   text      default 'manual',
  rules                          jsonb,
  plan                           text      default 'starter',
  stripe_customer_id             text,
  stripe_subscription_id         text,
  created_at                     timestamptz default now(),
  -- ── Columns added post-initial-schema, consolidated 2026-04-24 ────────────
  -- See supabase/migrations/20260424_brands_schema_consolidation.sql and
  -- docs/phase0-schema-audit.md for provenance and type confidence notes.
  visual_style                   text,
  logo_url                       text,
  city                           text,
  secondary_sectors              text[]    default '{}',
  subscribed_platforms           text[]    default '{}',
  competitors                    text[]    default '{}',
  compliance_flags               jsonb,
  content_mix_preferences        jsonb,
  human_review_config            jsonb,
  require_worker_review          boolean   default true,
  use_new_planning_flow          boolean   default false,
  onboarding_content_triggered   boolean   default false,
  marketing_consent              boolean   default false,
  notify_email_comments          boolean   default true,
  notify_email_publish           boolean   default true,
  posts_this_week                integer   default 0,
  stories_this_week              integer   default 0,
  brief_completion_pct           integer   default 0,
  churn_score                    integer   default 0,
  churn_risk                     text      default 'low',
  rejected_in_a_row              integer   default 0,
  auto_approve_after_days        integer   default 0,
  purchased_extra_accounts       integer   default 0,
  ig_username                    text,
  fb_page_name                   text,
  tt_username                    text,
  tt_open_id                     text,
  tt_access_token                text,
  tt_refresh_token               text,
  tt_token_expires_at            timestamptz,
  meta_token_expires_at          timestamptz,
  first_content_at               timestamptz,
  last_post_published_at         timestamptz,
  last_login_at                  timestamptz,
  last_onboarding_email_at       timestamptz,
  last_no_content_email_at       timestamptz,
  last_no_social_email_at        timestamptz,
  last_plan_unused_email_at      timestamptz,
  last_reactivation_email_at     timestamptz,
  marketing_consent_at           timestamptz,
  dpa_accepted_at                timestamptz,
  ai_disclosure_committed_at     timestamptz,
  plan_started_at                timestamptz,
  plan_cancels_at                timestamptz,
  trial_ends_at                  timestamptz,
  week_reset_at                  timestamptz default now(),
  calendar_events_generated_at   timestamptz,
  -- ── Phase 1 creative direction fields (2026-04-24) ────────────────────────
  -- See supabase/migrations/20260424_brand_kit_creative_direction.sql
  aesthetic_preset               text      default 'editorial',
  realism_level                  integer   default 70,
  typography_display             text      default 'barlow_condensed',
  typography_body                text      default 'barlow',
  allow_graphic_elements         boolean   not null default true,
  overlay_intensity              text      default 'medium'
);

alter table public.brands enable row level security;

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

-- ─── Media Library ────────────────────────────────────────────────────────
create table if not exists public.media_library (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references public.brands(id) on delete cascade,
  storage_path text not null,
  url         text not null,
  type        text not null check (type in ('image', 'video')),
  mime_type   text,
  size_bytes  bigint,
  duration    real,          -- duración en segundos (solo vídeos)
  width       integer,
  height      integer,
  created_at  timestamptz default now()
);

alter table public.media_library enable row level security;

create policy "media_library: brand owner access"
  on public.media_library for all
  using (
    exists (
      select 1 from public.brands
      where brands.id = media_library.brand_id
        and brands.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brands
      where brands.id = media_library.brand_id
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
create index if not exists idx_media_library_brand  on public.media_library(brand_id);
create index if not exists idx_media_library_type   on public.media_library(brand_id, type);
