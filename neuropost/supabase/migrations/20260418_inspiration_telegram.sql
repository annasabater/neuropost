-- =============================================================================
-- NEUROPOST — Inspiration Bank (Telegram-fed)
-- Tablas: inspiration_bank (resultado) + inspiration_queue (jobs de ingesta)
-- =============================================================================

-- Tabla principal: banco de inspiración alimentado por Telegram
create table if not exists inspiration_bank (
  id                  uuid primary key default gen_random_uuid(),
  media_type          text not null check (media_type in ('image','carousel','video')),
  media_urls          text[] not null,
  thumbnail_url       text,
  video_frames_urls   text[] default '{}',
  perceptual_hash     text,

  -- Descripciones generadas por Claude Vision (ocultas al cliente)
  hidden_prompt       text not null,
  slide_prompts       text[] default '{}',
  scene_prompts       text[] default '{}',
  motion_description  text,

  -- Clasificación
  category            text not null default 'otros',  -- uno de SocialSector o 'otros'
  tags                text[] default '{}',
  dominant_colors     text[] default '{}',
  mood                text,

  -- Metadata de origen
  source_platform     text,      -- 'instagram','tiktok','pinterest','telegram_direct'
  source_url          text,
  ingested_by         uuid references auth.users(id),
  created_at          timestamptz default now()
);

create index if not exists idx_ib_category on inspiration_bank(category);
create index if not exists idx_ib_tags     on inspiration_bank using gin(tags);
create index if not exists idx_ib_created  on inspiration_bank(created_at desc);
create index if not exists idx_ib_phash    on inspiration_bank(perceptual_hash);

alter table inspiration_bank enable row level security;

drop policy if exists "authenticated can read inspiration_bank" on inspiration_bank;
create policy "authenticated can read inspiration_bank"
  on inspiration_bank for select
  to authenticated
  using (true);

-- =============================================================================
-- Cola de ingestión
-- =============================================================================

do $$ begin
  create type ingestion_status as enum ('pending','processing','done','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ingestion_source as enum (
    'telegram_photo','telegram_video','telegram_document','telegram_media_group',
    'instagram_url','tiktok_url','pinterest_url','generic_url'
  );
exception when duplicate_object then null; end $$;

create table if not exists inspiration_queue (
  id                   uuid primary key default gen_random_uuid(),
  source               ingestion_source not null,
  payload              jsonb not null,
  telegram_chat_id     bigint,
  telegram_message_id  bigint,
  media_group_id       text,
  status               ingestion_status default 'pending',
  attempts             int default 0,
  last_error           text,
  result_item_id       uuid references inspiration_bank(id),
  created_at           timestamptz default now(),
  processed_at         timestamptz
);

create index if not exists idx_iq_pending
  on inspiration_queue(status, created_at)
  where status = 'pending';

create index if not exists idx_iq_media_group
  on inspiration_queue(media_group_id)
  where media_group_id is not null;

alter table inspiration_queue enable row level security;
-- Sin policies públicas: solo createAdminClient accede
