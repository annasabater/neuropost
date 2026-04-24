-- ═══════════════════════════════════════════════════════════════════════════
-- Split human_review_config flags into _create and _regen variants
-- ═══════════════════════════════════════════════════════════════════════════
-- Before:  { messages, images, videos, requests }
-- After:   { messages_create, images_create, videos_create,
--            messages_regen,  images_regen,  videos_regen,
--            requests }
--
-- Each old flag is copied to both _create and _regen (same value) so
-- existing behaviour is preserved until a worker explicitly tunes the
-- new flags. The `requests` flag stays as-is (still reserved).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Global defaults in app_settings.
UPDATE public.app_settings
SET value = jsonb_build_object(
    'messages_create', COALESCE(value->'messages_create', value->'messages', 'true'::jsonb),
    'images_create',   COALESCE(value->'images_create',   value->'images',   'true'::jsonb),
    'videos_create',   COALESCE(value->'videos_create',   value->'videos',   'true'::jsonb),
    'messages_regen',  COALESCE(value->'messages_regen',  value->'messages', 'true'::jsonb),
    'images_regen',    COALESCE(value->'images_regen',    value->'images',   'true'::jsonb),
    'videos_regen',    COALESCE(value->'videos_regen',    value->'videos',   'true'::jsonb),
    'requests',        COALESCE(value->'requests',                           'true'::jsonb)
  ),
  updated_at = NOW()
WHERE key = 'human_review_defaults';

-- Seed the row if it didn't exist yet (fresh install).
INSERT INTO public.app_settings (key, value)
VALUES (
  'human_review_defaults',
  '{"messages_create":true,"images_create":true,"videos_create":true,"messages_regen":true,"images_regen":true,"videos_regen":true,"requests":true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 2. Per-brand overrides — only rewrite rows that still carry old keys.
--    A brand with NULL config inherits; nothing to migrate there.
--    Each old key present in the diff is copied into both _create and _regen;
--    missing keys are stripped so the diff stays minimal.
UPDATE public.brands
SET human_review_config = (
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'messages_create', human_review_config->'messages',
    'images_create',   human_review_config->'images',
    'videos_create',   human_review_config->'videos',
    'messages_regen',  human_review_config->'messages',
    'images_regen',    human_review_config->'images',
    'videos_regen',    human_review_config->'videos',
    'requests',        human_review_config->'requests'
  ))
)
WHERE human_review_config IS NOT NULL
  AND (
        human_review_config ? 'messages'
     OR human_review_config ? 'images'
     OR human_review_config ? 'videos'
  );

-- 3. Post-migration verification (run manually):
--    SELECT key, value FROM app_settings WHERE key='human_review_defaults';
--    SELECT id, name, human_review_config FROM brands
--      WHERE human_review_config IS NOT NULL;
