-- Add generated_images array to posts for multi-photo generation results
-- Each URL in the array is a validated, approved image ready for client review.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS generated_images text[] DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_total  int  DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS generation_done   int  DEFAULT 0;
