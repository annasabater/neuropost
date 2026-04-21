-- Sprint 10: add story-related columns to content_ideas

ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS story_type   text,
  ADD COLUMN IF NOT EXISTS template_id  uuid,
  ADD COLUMN IF NOT EXISTS rendered_image_url text;

ALTER TABLE public.content_ideas
  DROP CONSTRAINT IF EXISTS content_ideas_content_kind_check;
ALTER TABLE public.content_ideas
  ADD CONSTRAINT content_ideas_content_kind_check
    CHECK (content_kind IN ('post', 'story'));

ALTER TABLE public.content_ideas
  DROP CONSTRAINT IF EXISTS content_ideas_story_type_check;
ALTER TABLE public.content_ideas
  ADD CONSTRAINT content_ideas_story_type_check
    CHECK (story_type IS NULL OR story_type IN ('schedule','quote','promo','data','custom','photo'));

CREATE INDEX IF NOT EXISTS idx_content_ideas_kind_week
  ON public.content_ideas(week_id, content_kind);
