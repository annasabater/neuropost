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
