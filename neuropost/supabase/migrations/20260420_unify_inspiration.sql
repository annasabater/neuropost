-- =============================================================================
-- NEUROPOST — Unify inspiration sources (legacy `inspiration_references` +
-- Telegram `inspiration_bank`) behind a single view + common favorite/save
-- tables with a `source` discriminator. Idempotent — safe to run twice.
-- =============================================================================

-- ─── Collections (private per brand) ────────────────────────────────────────

create table if not exists inspiration_collections (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  name        text not null,
  description text,
  cover_url   text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (brand_id, name)
);

create index if not exists idx_ic_brand on inspiration_collections(brand_id);

alter table inspiration_collections enable row level security;

drop policy if exists "inspiration_collections: owner select" on inspiration_collections;
create policy "inspiration_collections: owner select"
  on inspiration_collections for select to authenticated
  using (brand_id in (select id from brands where user_id = auth.uid()));

drop policy if exists "inspiration_collections: owner write" on inspiration_collections;
create policy "inspiration_collections: owner write"
  on inspiration_collections for all to authenticated
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));

-- ─── Saved items (brand ↔ item ↔ optional collection) ──────────────────────

create table if not exists inspiration_saved (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  source         text not null check (source in ('legacy','bank')),
  item_id        uuid not null,
  collection_id  uuid references inspiration_collections(id) on delete set null,
  notes          text,
  created_at     timestamptz default now()
);

-- A brand can save the same item once with no collection AND once per
-- collection; enforce uniqueness treating NULL collection as a distinct "bucket".
create unique index if not exists ux_is_brand_source_item_coll
  on inspiration_saved (brand_id, source, item_id, coalesce(collection_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_is_brand      on inspiration_saved(brand_id);
create index if not exists idx_is_collection on inspiration_saved(collection_id);
create index if not exists idx_is_item       on inspiration_saved(source, item_id);

alter table inspiration_saved enable row level security;

drop policy if exists "inspiration_saved: owner select" on inspiration_saved;
create policy "inspiration_saved: owner select"
  on inspiration_saved for select to authenticated
  using (brand_id in (select id from brands where user_id = auth.uid()));

drop policy if exists "inspiration_saved: owner write" on inspiration_saved;
create policy "inspiration_saved: owner write"
  on inspiration_saved for all to authenticated
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));

-- ─── Favorites (brand ↔ item) ──────────────────────────────────────────────

create table if not exists inspiration_favorites (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  source     text not null check (source in ('legacy','bank')),
  item_id    uuid not null,
  created_at timestamptz default now(),
  unique (brand_id, source, item_id)
);

create index if not exists idx_if_brand on inspiration_favorites(brand_id);

alter table inspiration_favorites enable row level security;

drop policy if exists "inspiration_favorites: owner select" on inspiration_favorites;
create policy "inspiration_favorites: owner select"
  on inspiration_favorites for select to authenticated
  using (brand_id in (select id from brands where user_id = auth.uid()));

drop policy if exists "inspiration_favorites: owner write" on inspiration_favorites;
create policy "inspiration_favorites: owner write"
  on inspiration_favorites for all to authenticated
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));

-- ─── Backfill from legacy boolean flags ────────────────────────────────────
-- Every existing is_favorite=true row gets a mirror entry in
-- inspiration_favorites. The legacy bool column is NOT dropped — some code
-- paths still read it; the new tables become the source of truth for the UI.

insert into inspiration_favorites (brand_id, source, item_id, created_at)
select brand_id, 'legacy', id, coalesce(created_at, now())
from inspiration_references
where is_favorite = true
  and brand_id is not null
on conflict (brand_id, source, item_id) do nothing;

-- is_saved defaults to TRUE in the legacy schema, so "user_saved" really means
-- "user explicitly saved from the UI". Backfill only rows whose origin is
-- 'user_saved' — the rest (editorial / ai_generated) aren't personal saves.
insert into inspiration_saved (brand_id, source, item_id, created_at)
select brand_id, 'legacy', id, coalesce(created_at, now())
from inspiration_references
where coalesce(origin, 'user_saved') = 'user_saved'
  and is_saved = true
  and brand_id is not null
on conflict (brand_id, source, item_id, coalesce(collection_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do nothing;

-- ─── Unified view ──────────────────────────────────────────────────────────
-- NOTE: hidden_prompt / slide_prompts / scene_prompts intentionally NOT
-- exposed here — those are for server-side remix only.

create or replace view inspiration_unified as
  -- Legacy references — map into bank shape
  select
    ir.id,
    'legacy'::text            as source,
    -- format is 'image' | 'reel' | 'carousel' | 'video'; reel → video for the view
    case
      when ir.format = 'reel'     then 'video'
      when ir.format in ('image','carousel','video') then ir.format
      else 'image'
    end                        as media_type,
    -- Legacy only has a single URL; wrap in an array
    case when ir.source_url is not null then array[ir.source_url]
         when ir.thumbnail_url is not null then array[ir.thumbnail_url]
         else array[]::text[]
    end                        as media_urls,
    ir.thumbnail_url,
    ir.category,
    coalesce(ir.style_tags, array[]::text[]) as tags,
    null::text[]              as dominant_colors,
    null::text                as mood,
    ir.created_at,
    ir.brand_id,
    coalesce(ir.origin, 'user_saved') as origin,
    ir.title,
    ir.notes,
    null::text[]              as video_frames_urls,
    null::text                as source_platform,
    ir.source_url             as source_url
  from inspiration_references ir
  union all
  -- Inspiration bank — globally visible, no brand ownership at row level
  select
    ib.id,
    'bank'::text              as source,
    ib.media_type,
    ib.media_urls,
    ib.thumbnail_url,
    ib.category,
    coalesce(ib.tags, array[]::text[])            as tags,
    coalesce(ib.dominant_colors, array[]::text[]) as dominant_colors,
    ib.mood,
    ib.created_at,
    null::uuid                as brand_id,
    'bank'::text              as origin,
    null::text                as title,
    null::text                as notes,
    coalesce(ib.video_frames_urls, array[]::text[]) as video_frames_urls,
    ib.source_platform,
    ib.source_url
  from inspiration_bank ib;

comment on view inspiration_unified is
  'Public facade over inspiration_references + inspiration_bank. '
  'Excludes hidden_prompt / slide_prompts / scene_prompts by design. '
  'Client reads through this view via /api/inspiracion/list.';
