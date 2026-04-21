-- Add edited_image_url to posts.
--
-- Semantic contract:
--   posts.image_url       = the file the client uploaded (original, never overwritten by the pipeline)
--   posts.edited_image_url = the AI-generated/edited result (written by handlers + Replicate webhook)
--
-- Backfill: posts that went through the old pipeline already have the
-- generated image sitting in image_url (the bug). Copy it to edited_image_url
-- so they keep displaying correctly under the new semantic. image_url is left
-- as-is — it now semantically means "original upload" even if it contains a
-- generated image for these legacy rows.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS edited_image_url text;

-- Backfill rows where the pipeline already ran: statuses that imply the
-- worker/AI touched the post. Skip 'request'/'draft' (pipeline not yet run).
UPDATE public.posts
SET edited_image_url = image_url
WHERE edited_image_url IS NULL
  AND image_url IS NOT NULL
  AND status IN ('generated', 'pending', 'approved', 'scheduled', 'published', 'failed', 'needs_human_review');
