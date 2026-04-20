-- =============================================================================
-- NEUROPOST — Extended notification preferences + unsubscribe tokens +
-- GDPR marketing consent + email queue (used by later phases)
-- =============================================================================

-- ─── Extended notification_preferences ──────────────────────────────────────

alter table notification_preferences
  add column if not exists approval_needed_email       boolean default true,
  add column if not exists ticket_reply_email          boolean default true,
  add column if not exists chat_message_email          boolean default true,
  add column if not exists recreation_ready_email      boolean default true,
  add column if not exists comment_pending_email       boolean default false,
  add column if not exists token_expired_email         boolean default true,
  add column if not exists post_published_email        boolean default true,
  add column if not exists post_failed_email           boolean default true,
  add column if not exists payment_failed_email        boolean default true,
  add column if not exists trial_ending_email          boolean default true,
  add column if not exists limit_reached_email         boolean default true,
  add column if not exists reactivation_email          boolean default true,
  add column if not exists no_content_email            boolean default true,
  add column if not exists onboarding_incomplete_email boolean default true,
  add column if not exists no_social_connected_email   boolean default true,
  add column if not exists plan_unused_email           boolean default true,
  add column if not exists weekly_report_email         boolean default true,
  add column if not exists monthly_report_email        boolean default true,
  add column if not exists daily_digest_email          boolean default false,
  add column if not exists marketing_email             boolean default false,
  add column if not exists product_updates_email       boolean default false,
  add column if not exists newsletter_email            boolean default false,
  add column if not exists email_language              text,
  add column if not exists max_frequency               text default 'immediate'
    check (max_frequency in ('immediate','daily','weekly'));

-- ─── Anti-spam timestamps on brands ──────────────────────────────────────────

alter table brands
  add column if not exists last_reactivation_email_at timestamptz,
  add column if not exists last_no_content_email_at   timestamptz,
  add column if not exists last_onboarding_email_at   timestamptz,
  add column if not exists last_no_social_email_at    timestamptz,
  add column if not exists last_plan_unused_email_at  timestamptz;

-- ─── GDPR marketing consent ──────────────────────────────────────────────────

alter table brands
  add column if not exists marketing_consent    boolean default false,
  add column if not exists marketing_consent_at timestamptz;

-- ─── Unsubscribe tokens (one per brand, rotatable) ───────────────────────────

create table if not exists email_unsubscribe_tokens (
  token        uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  created_at   timestamptz default now(),
  last_used_at timestamptz
);

create index if not exists idx_eut_brand on email_unsubscribe_tokens(brand_id);

alter table email_unsubscribe_tokens enable row level security;
-- Sin policies públicas — solo createAdminClient() accede.

-- ─── Email queue (used by FASE N6 — daily/weekly digest) ─────────────────────

create table if not exists email_queue (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  email_type text not null,
  subject    text not null,
  preview    text,
  payload    jsonb not null,
  send_at    timestamptz default now(),
  sent_at    timestamptz,
  status     text default 'pending' check (status in ('pending','sent','failed','cancelled')),
  attempts   int default 0,
  last_error text,
  created_at timestamptz default now()
);

create index if not exists idx_eq_pending on email_queue(status, send_at) where status = 'pending';
create index if not exists idx_eq_brand   on email_queue(brand_id);

alter table email_queue enable row level security;
-- Sin policies públicas — solo createAdminClient() accede.
