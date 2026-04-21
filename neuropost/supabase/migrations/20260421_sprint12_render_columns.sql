-- Sprint 12: render_error + logo_url
ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS render_error text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_url text;
