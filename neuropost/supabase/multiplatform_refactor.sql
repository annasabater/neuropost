-- ============================================================================
-- NeuroPost — Phase 1 of the multi-platform refactor
--
-- Creates two new tables (`platform_connections`, `post_publications`) and
-- backfills them from the legacy columns currently living on `brands` and
-- `posts`. The old columns are NOT dropped by this migration — they stay
-- in place as a safety net while code routes are migrated to the new tables.
-- A follow-up migration (phase 1b) will drop them once every read-path has
-- moved over.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS and every backfill uses
-- ON CONFLICT DO NOTHING. Backfill only inserts rows that don't already exist.
--
-- Affects: platform_connections (new), post_publications (new),
--          ab_tests (adds `platform`), brands (untouched), posts (untouched).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- Shared helper: set_updated_at trigger function
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. platform_connections
--    One row per (brand, platform). Replaces the scattered ig_*, fb_*, tt_*
--    columns on `brands`. `metadata` JSONB absorbs anything platform-specific
--    that doesn't deserve a top-level column.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_connections (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                   uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  platform                   text        NOT NULL
                                          CHECK (platform IN ('instagram', 'facebook', 'tiktok')),

  -- Platform-side identifiers
  platform_user_id           text        NOT NULL,   -- IG business account id, FB page id, TikTok open_id
  platform_username          text,                   -- @handle, Page name, display name (shown in UI)

  -- OAuth
  access_token               text        NOT NULL,
  refresh_token              text,                   -- only TikTok uses it
  expires_at                 timestamptz,
  refresh_expires_at         timestamptz,            -- only TikTok

  -- Bookkeeping used by the refresh-tokens cron + analytics syncs
  status                     text        NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_token_refresh_at      timestamptz,
  last_insights_synced_at    timestamptz,
  last_feed_synced_at        timestamptz,

  -- Anything platform-specific without its own column
  metadata                   jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  UNIQUE (brand_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_brand
  ON public.platform_connections (brand_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_active
  ON public.platform_connections (brand_id, platform) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_platform_connections_expiring
  ON public.platform_connections (expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_platform_connections_updated ON public.platform_connections;
CREATE TRIGGER trg_platform_connections_updated
  BEFORE UPDATE ON public.platform_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_platform_connections" ON public.platform_connections;
CREATE POLICY "service_role_all_platform_connections"
  ON public.platform_connections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. post_publications
--    Fan-out table: one row per (post, platform). A single logical post in
--    the existing `posts` table can produce up to 3 publications, each with
--    its own adapted caption, scheduled time, and platform response.
--    The existing 9-state machine on `posts.status` stays as the "overall"
--    state; this row tracks the per-platform lifecycle.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_publications (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id                uuid        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform               text        NOT NULL
                                      CHECK (platform IN ('instagram', 'facebook', 'tiktok')),

  -- Per-platform adapted content (null = use posts.caption / posts.hashtags)
  caption                text,
  hashtags               text[]      NOT NULL DEFAULT '{}',

  -- Per-platform schedule (null = use posts.scheduled_at)
  scheduled_at           timestamptz,
  published_at           timestamptz,

  -- Platform response after a successful publish
  platform_post_id       text,        -- IG media id, FB post id, TikTok video id
  platform_post_url      text,        -- Deep link to the published post (optional)

  -- Per-publication lifecycle — separate from posts.status which is the
  -- overall post state.
  status                 text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN (
                                        'pending',      -- not yet scheduled
                                        'scheduled',    -- waiting for publish-scheduled cron
                                        'publishing',   -- in-flight at the platform API
                                        'published',
                                        'failed',
                                        'cancelled'
                                      )),
  error_message          text,
  error_count            int         NOT NULL DEFAULT 0,
  last_attempt_at        timestamptz,

  -- Privacy level, targeting, FB page id override, etc.
  metadata               jsonb       NOT NULL DEFAULT '{}'::jsonb,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (post_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_post_publications_post
  ON public.post_publications (post_id);
CREATE INDEX IF NOT EXISTS idx_post_publications_platform
  ON public.post_publications (platform);
CREATE INDEX IF NOT EXISTS idx_post_publications_scheduled
  ON public.post_publications (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_post_publications_status_platform
  ON public.post_publications (status, platform);

DROP TRIGGER IF EXISTS trg_post_publications_updated ON public.post_publications;
CREATE TRIGGER trg_post_publications_updated
  BEFORE UPDATE ON public.post_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.post_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_post_publications" ON public.post_publications;
CREATE POLICY "service_role_all_post_publications"
  ON public.post_publications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Add `platform` to tables that were missing it
--    (comments, post_analytics already have it; ab_tests does not)
--    Defensive: only touches ab_tests if premium_features.sql has run.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ab_tests') IS NOT NULL THEN
    EXECUTE $sql$
      ALTER TABLE public.ab_tests
        ADD COLUMN IF NOT EXISTS platform text DEFAULT 'instagram'
          CHECK (platform IN ('instagram', 'facebook', 'tiktok'))
    $sql$;
    EXECUTE $sql$ CREATE INDEX IF NOT EXISTS idx_ab_tests_platform ON public.ab_tests (platform) $sql$;
  ELSE
    RAISE NOTICE 'Skipping ab_tests.platform: table not present (premium_features.sql not applied?)';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Backfill platform_connections from legacy columns on `brands`
--    Each INSERT only fires for brands that actually have the token set.
--    ON CONFLICT DO NOTHING so re-running doesn't clobber newer data.
-- ────────────────────────────────────────────────────────────────────────────

-- 4.a Instagram
--   Note: we do NOT copy a last_token_refresh_at value because the legacy
--   schema doesn't track it. It'll be populated from the first refresh
--   the cron runs against the new row.
INSERT INTO public.platform_connections
  (brand_id, platform, platform_user_id, platform_username,
   access_token, expires_at, status, metadata)
SELECT
  b.id, 'instagram',
  b.ig_account_id,
  b.ig_username,
  b.ig_access_token,
  b.meta_token_expires_at,
  CASE
    WHEN b.meta_token_expires_at IS NULL            THEN 'active'
    WHEN b.meta_token_expires_at > now()            THEN 'active'
    ELSE 'expired'
  END,
  jsonb_build_object('backfilled_from', 'brands.ig_*')
FROM public.brands b
WHERE b.ig_access_token IS NOT NULL
  AND b.ig_account_id   IS NOT NULL
ON CONFLICT (brand_id, platform) DO NOTHING;

-- 4.b Facebook
INSERT INTO public.platform_connections
  (brand_id, platform, platform_user_id, platform_username,
   access_token, expires_at, status, metadata)
SELECT
  b.id, 'facebook',
  b.fb_page_id,
  b.fb_page_name,
  b.fb_access_token,
  b.meta_token_expires_at,  -- Meta tokens share the same expiry clock
  CASE
    WHEN b.meta_token_expires_at IS NULL OR b.meta_token_expires_at > now() THEN 'active'
    ELSE 'expired'
  END,
  jsonb_build_object('backfilled_from', 'brands.fb_*', 'page_id', b.fb_page_id)
FROM public.brands b
WHERE b.fb_access_token IS NOT NULL
  AND b.fb_page_id      IS NOT NULL
ON CONFLICT (brand_id, platform) DO NOTHING;

-- 4.c TikTok
INSERT INTO public.platform_connections
  (brand_id, platform, platform_user_id, platform_username,
   access_token, refresh_token, expires_at, status, metadata)
SELECT
  b.id, 'tiktok',
  b.tt_open_id,
  b.tt_username,
  b.tt_access_token,
  b.tt_refresh_token,
  b.tt_token_expires_at,
  CASE
    WHEN b.tt_token_expires_at IS NULL OR b.tt_token_expires_at > now() THEN 'active'
    ELSE 'expired'
  END,
  jsonb_build_object('backfilled_from', 'brands.tt_*')
FROM public.brands b
WHERE b.tt_access_token IS NOT NULL
  AND b.tt_open_id      IS NOT NULL
ON CONFLICT (brand_id, platform) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Backfill post_publications from legacy per-platform columns on `posts`
--    For every existing post, emit one row per platform the post was meant
--    to publish to. A post with `'instagram' = ANY(platform)` gets an IG
--    publication row. If the post already has `ig_post_id`, that row is
--    marked 'published' (with the platform_post_id) otherwise 'scheduled'
--    if the global status was scheduled, otherwise 'pending'.
-- ────────────────────────────────────────────────────────────────────────────

-- 5.a Instagram
INSERT INTO public.post_publications
  (post_id, platform, caption, hashtags,
   scheduled_at, published_at, platform_post_id, status, metadata)
SELECT
  p.id, 'instagram',
  p.caption,
  COALESCE(p.hashtags, '{}'),
  p.scheduled_at,
  p.published_at,
  p.ig_post_id,
  CASE
    WHEN p.ig_post_id IS NOT NULL AND p.published_at IS NOT NULL THEN 'published'
    WHEN p.status = 'failed'     THEN 'failed'
    WHEN p.status = 'cancelled'  THEN 'cancelled'
    WHEN p.status = 'scheduled'  THEN 'scheduled'
    ELSE 'pending'
  END,
  jsonb_build_object('backfilled_from', 'posts.legacy')
FROM public.posts p
WHERE 'instagram' = ANY(p.platform)
   OR p.ig_post_id IS NOT NULL
ON CONFLICT (post_id, platform) DO NOTHING;

-- 5.b Facebook
INSERT INTO public.post_publications
  (post_id, platform, caption, hashtags,
   scheduled_at, published_at, platform_post_id, status, metadata)
SELECT
  p.id, 'facebook',
  p.caption,
  COALESCE(p.hashtags, '{}'),
  p.scheduled_at,
  p.published_at,
  p.fb_post_id,
  CASE
    WHEN p.fb_post_id IS NOT NULL AND p.published_at IS NOT NULL THEN 'published'
    WHEN p.status = 'failed'     THEN 'failed'
    WHEN p.status = 'cancelled'  THEN 'cancelled'
    WHEN p.status = 'scheduled'  THEN 'scheduled'
    ELSE 'pending'
  END,
  jsonb_build_object('backfilled_from', 'posts.legacy')
FROM public.posts p
WHERE 'facebook' = ANY(p.platform)
   OR p.fb_post_id IS NOT NULL
ON CONFLICT (post_id, platform) DO NOTHING;

-- 5.c TikTok
-- Extra rule: TikTok only supports video / reel formats. Skip backfill for
-- rows whose format is explicitly 'foto' or 'carousel' — those never had
-- a real TikTok publication even if platform=['...','tiktok'] was set.
-- Defensive: if posts.tiktok_video_id doesn't exist (premium_features.sql
-- not applied), fall back to a version that only uses posts.platform[].
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'tiktok_video_id'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.post_publications
        (post_id, platform, caption, hashtags,
         scheduled_at, published_at, platform_post_id, status, metadata)
      SELECT
        p.id, 'tiktok',
        p.caption,
        COALESCE(p.hashtags, '{}'),
        p.scheduled_at,
        p.published_at,
        p.tiktok_video_id,
        CASE
          WHEN p.tiktok_video_id IS NOT NULL AND p.published_at IS NOT NULL THEN 'published'
          WHEN p.status = 'failed'     THEN 'failed'
          WHEN p.status = 'cancelled'  THEN 'cancelled'
          WHEN p.status = 'scheduled'  THEN 'scheduled'
          ELSE 'pending'
        END,
        jsonb_build_object('backfilled_from', 'posts.legacy')
      FROM public.posts p
      WHERE ('tiktok' = ANY(p.platform) OR p.tiktok_video_id IS NOT NULL)
        AND (p.format IS NULL OR p.format IN ('reel', 'video', 'videos'))
      ON CONFLICT (post_id, platform) DO NOTHING
    $sql$;
  ELSE
    EXECUTE $sql$
      INSERT INTO public.post_publications
        (post_id, platform, caption, hashtags,
         scheduled_at, published_at, status, metadata)
      SELECT
        p.id, 'tiktok',
        p.caption,
        COALESCE(p.hashtags, '{}'),
        p.scheduled_at,
        p.published_at,
        CASE
          WHEN p.status = 'failed'     THEN 'failed'
          WHEN p.status = 'cancelled'  THEN 'cancelled'
          WHEN p.status = 'scheduled'  THEN 'scheduled'
          WHEN p.published_at IS NOT NULL THEN 'published'
          ELSE 'pending'
        END,
        jsonb_build_object('backfilled_from', 'posts.legacy')
      FROM public.posts p
      WHERE 'tiktok' = ANY(p.platform)
        AND (p.format IS NULL OR p.format IN ('reel', 'video', 'videos'))
      ON CONFLICT (post_id, platform) DO NOTHING
    $sql$;
    RAISE NOTICE 'posts.tiktok_video_id absent — TikTok backfill ran without platform_post_id';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Sanity counters — surfaced in NOTICE so the user sees what moved.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_conn_ig   int;
  n_conn_fb   int;
  n_conn_tt   int;
  n_pub_ig    int;
  n_pub_fb    int;
  n_pub_tt    int;
BEGIN
  SELECT count(*) INTO n_conn_ig FROM public.platform_connections WHERE platform = 'instagram';
  SELECT count(*) INTO n_conn_fb FROM public.platform_connections WHERE platform = 'facebook';
  SELECT count(*) INTO n_conn_tt FROM public.platform_connections WHERE platform = 'tiktok';
  SELECT count(*) INTO n_pub_ig  FROM public.post_publications    WHERE platform = 'instagram';
  SELECT count(*) INTO n_pub_fb  FROM public.post_publications    WHERE platform = 'facebook';
  SELECT count(*) INTO n_pub_tt  FROM public.post_publications    WHERE platform = 'tiktok';

  RAISE NOTICE '───────────────────────────────────────────────────────────────';
  RAISE NOTICE '  platform_connections:  IG=%  FB=%  TT=%', n_conn_ig, n_conn_fb, n_conn_tt;
  RAISE NOTICE '  post_publications:     IG=%  FB=%  TT=%', n_pub_ig, n_pub_fb, n_pub_tt;
  RAISE NOTICE '───────────────────────────────────────────────────────────────';
END
$$;

COMMIT;

-- ============================================================================
-- Follow-up (phase 1b, NOT RUN BY THIS FILE):
--   Once every code path reads tokens from platform_connections and every
--   publish writes to post_publications, drop the legacy columns:
--     ALTER TABLE brands DROP COLUMN ig_account_id, ig_access_token, ig_username,
--                                    fb_page_id, fb_page_name, fb_access_token,
--                                    meta_token_expires_at, token_refreshed_at,
--                                    tt_open_id, tt_username, tt_access_token,
--                                    tt_refresh_token, tt_token_expires_at;
--     ALTER TABLE posts  DROP COLUMN ig_post_id, fb_post_id, tiktok_video_id,
--                                    tiktok_publish_id;
-- ============================================================================
