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

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_brands_user_id       on public.brands(user_id);
create index if not exists idx_posts_brand_id       on public.posts(brand_id);
create index if not exists idx_posts_status         on public.posts(status);
create index if not exists idx_posts_scheduled_at   on public.posts(scheduled_at);
create index if not exists idx_comments_brand_id    on public.comments(brand_id);
create index if not exists idx_notifications_brand  on public.notifications(brand_id);
create index if not exists idx_notifications_read   on public.notifications(brand_id, read);
