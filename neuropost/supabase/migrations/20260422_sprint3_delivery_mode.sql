-- Sprint 3: add delivery_mode to posts
-- 'instant'  → client wants auto-result without worker review
-- 'reviewed' → worker reviews before client sees result (default)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS delivery_mode text
    CHECK (delivery_mode IN ('instant', 'reviewed'))
    DEFAULT 'reviewed';
