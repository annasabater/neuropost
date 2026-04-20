-- ═══════════════════════════════════════════════════════════════════════════════
-- Generated Assets — Versiones de imágenes/videos generados por IA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE generated_assets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id      uuid REFERENCES brands(id) ON DELETE CASCADE,
  post_id       uuid REFERENCES posts(id) ON DELETE CASCADE,
  version       integer NOT NULL DEFAULT 1,
  -- Asset data
  asset_url     text NOT NULL,
  asset_type    text NOT NULL DEFAULT 'image',      -- 'image' | 'video'
  storage_path  text,                                -- path in Supabase storage
  -- Generation context
  prompt        text,                                -- prompt used to generate
  inspiration_id uuid REFERENCES inspiration_references(id) ON DELETE SET NULL,
  model         text,                                -- e.g. 'seedream', 'dall-e-3', 'runway'
  parameters    jsonb DEFAULT '{}',                  -- model-specific params (style, quality, etc.)
  -- Review
  status        text NOT NULL DEFAULT 'generated',   -- 'generated' | 'approved' | 'rejected' | 'published'
  is_current    boolean NOT NULL DEFAULT true,        -- only one version is "current" per post
  approved_at   timestamptz,
  approved_by   text,
  rejection_reason text,
  -- Metadata
  quality_score numeric,
  ai_analysis   jsonb,                               -- visual tags, composition, etc.
  created_at    timestamptz DEFAULT now()
);

-- Only one "current" asset per post
CREATE UNIQUE INDEX generated_assets_current_idx
  ON generated_assets (post_id) WHERE is_current = true;

-- Fast lookups
CREATE INDEX generated_assets_post_id_idx ON generated_assets(post_id);
CREATE INDEX generated_assets_brand_id_idx ON generated_assets(brand_id);
CREATE INDEX generated_assets_status_idx ON generated_assets(status);

-- RLS
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owner access" ON generated_assets
  FOR ALL USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- Storage bucket for generated content
-- Run this via Supabase dashboard or management API:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('generated', 'generated', true);
--
-- CREATE POLICY "Brand upload" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'generated' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Public read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'generated');
-- ═══════════════════════════════════════════════════════════════════════════════
