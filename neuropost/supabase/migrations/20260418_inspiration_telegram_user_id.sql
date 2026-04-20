-- =============================================================================
-- NEUROPOST — Track which Telegram user ingested each bank item
-- Adds telegram_user_id (bigint) to both tables. ingested_by stays as the
-- auth.users uuid reference — they're orthogonal.
-- =============================================================================

alter table inspiration_bank
  add column if not exists telegram_user_id bigint;

alter table inspiration_queue
  add column if not exists telegram_user_id bigint;

create index if not exists idx_ib_tg_user on inspiration_bank(telegram_user_id);
