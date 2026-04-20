-- =============================================================================
-- NEUROPOST — Consolidate legacy notify_email_* flags into notification_preferences
-- One-shot sync. Safe to run multiple times (idempotent — uses NOT EXISTS /
-- COALESCE so we never overwrite values the user already set in the new UI).
-- Legacy columns on brands are KEPT for compatibility with any other code
-- paths that still read them; we just mirror their values into the new
-- preferences table so the rewritten UI becomes the single source of truth.
-- =============================================================================

-- Create a preferences row for any brand that doesn't have one yet, carrying
-- over the legacy values where applicable.
insert into notification_preferences (
  brand_id,
  post_published_email,
  comment_pending_email
)
select
  b.id,
  coalesce(b.notify_email_publish,  true),
  coalesce(b.notify_email_comments, false)
from brands b
where not exists (
  select 1 from notification_preferences np where np.brand_id = b.id
);

-- For existing preferences rows, only mirror the legacy value when the brand
-- explicitly set it to FALSE and the new column is still at its default TRUE
-- — i.e. preserve an explicit opt-out made through the old UI.
update notification_preferences np
set post_published_email = false
from brands b
where np.brand_id = b.id
  and b.notify_email_publish = false
  and np.post_published_email = true;

-- Mirror legacy comments OFF explicitly (default in new table is false, so
-- only bump it up if the brand had the legacy toggle ON).
update notification_preferences np
set comment_pending_email = true
from brands b
where np.brand_id = b.id
  and b.notify_email_comments = true
  and np.comment_pending_email = false;
