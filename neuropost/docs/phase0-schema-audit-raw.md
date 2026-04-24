# Phase 0.A — Brands schema audit

**Date:** 2026-04-24
**Source:** live DB probe of `public.brands` (sample row keys) + parse of `supabase/schema.sql`.
**Caveat:** the probe uses a sample row, so it lists column **names** but not precise types/defaults. For canonical types, cross-reference with Supabase dashboard.

## Columns live in DB that are MISSING from schema.sql

_(none — schema.sql already matches live)_

## Columns in schema.sql NOT visible in live sample

_(none)_

## Columns in schema.sql (canonical list parsed)

- `id` uuid DEFAULT uuid_generate_v4()
- `user_id` uuid NOT NULL
- `name` text NOT NULL
- `sector` text
- `tone` text
- `colors` jsonb
- `fonts` jsonb
- `slogans` text DEFAULT '{}'
- `hashtags` text DEFAULT '{}'
- `location` text
- `services` text DEFAULT '{}'
- `faq` jsonb
- `brand_voice_doc` text
- `ig_account_id` text
- `fb_page_id` text
- `ig_access_token` text
- `fb_access_token` text
- `auto_publish` boolean DEFAULT false
- `publish_mode` text DEFAULT 'manual'
- `rules` jsonb
- `plan` text DEFAULT 'starter'
- `stripe_customer_id` text
- `stripe_subscription_id` text
- `created_at` timestamptz DEFAULT now()
- `visual_style` text
- `logo_url` text
- `city` text
- `secondary_sectors` text DEFAULT '{}'
- `subscribed_platforms` text DEFAULT '{}'
- `competitors` text DEFAULT '{}'
- `compliance_flags` jsonb
- `content_mix_preferences` jsonb
- `human_review_config` jsonb
- `require_worker_review` boolean DEFAULT true
- `use_new_planning_flow` boolean DEFAULT false
- `onboarding_content_triggered` boolean DEFAULT false
- `marketing_consent` boolean DEFAULT false
- `notify_email_comments` boolean DEFAULT true
- `notify_email_publish` boolean DEFAULT true
- `posts_this_week` integer DEFAULT 0
- `stories_this_week` integer DEFAULT 0
- `brief_completion_pct` integer DEFAULT 0
- `churn_score` integer DEFAULT 0
- `churn_risk` text DEFAULT 'low'
- `rejected_in_a_row` integer DEFAULT 0
- `auto_approve_after_days` integer DEFAULT 0
- `purchased_extra_accounts` integer DEFAULT 0
- `ig_username` text
- `fb_page_name` text
- `tt_username` text
- `tt_open_id` text
- `tt_access_token` text
- `tt_refresh_token` text
- `tt_token_expires_at` timestamptz
- `meta_token_expires_at` timestamptz
- `first_content_at` timestamptz
- `last_post_published_at` timestamptz
- `last_login_at` timestamptz
- `last_onboarding_email_at` timestamptz
- `last_no_content_email_at` timestamptz
- `last_no_social_email_at` timestamptz
- `last_plan_unused_email_at` timestamptz
- `last_reactivation_email_at` timestamptz
- `marketing_consent_at` timestamptz
- `dpa_accepted_at` timestamptz
- `ai_disclosure_committed_at` timestamptz
- `plan_started_at` timestamptz
- `plan_cancels_at` timestamptz
- `trial_ends_at` timestamptz
- `week_reset_at` timestamptz DEFAULT now()
- `calendar_events_generated_at` timestamptz

## Columns in live sample (all keys of a sample row)

- `ai_disclosure_committed_at`
- `auto_approve_after_days`
- `auto_publish`
- `brand_voice_doc`
- `brief_completion_pct`
- `calendar_events_generated_at`
- `churn_risk`
- `churn_score`
- `city`
- `colors`
- `competitors`
- `compliance_flags`
- `content_mix_preferences`
- `created_at`
- `dpa_accepted_at`
- `faq`
- `fb_access_token`
- `fb_page_id`
- `fb_page_name`
- `first_content_at`
- `fonts`
- `hashtags`
- `human_review_config`
- `id`
- `ig_access_token`
- `ig_account_id`
- `ig_username`
- `last_login_at`
- `last_no_content_email_at`
- `last_no_social_email_at`
- `last_onboarding_email_at`
- `last_plan_unused_email_at`
- `last_post_published_at`
- `last_reactivation_email_at`
- `location`
- `logo_url`
- `marketing_consent`
- `marketing_consent_at`
- `meta_token_expires_at`
- `name`
- `notify_email_comments`
- `notify_email_publish`
- `onboarding_content_triggered`
- `plan`
- `plan_cancels_at`
- `plan_started_at`
- `posts_this_week`
- `publish_mode`
- `purchased_extra_accounts`
- `rejected_in_a_row`
- `require_worker_review`
- `rules`
- `secondary_sectors`
- `sector`
- `services`
- `slogans`
- `stories_this_week`
- `stripe_customer_id`
- `stripe_subscription_id`
- `subscribed_platforms`
- `tone`
- `trial_ends_at`
- `tt_access_token`
- `tt_open_id`
- `tt_refresh_token`
- `tt_token_expires_at`
- `tt_username`
- `use_new_planning_flow`
- `user_id`
- `visual_style`
- `week_reset_at`

## Parallel tables existence

| Table | Exists in DB |
|---|---|
| `seasonal_dates` | ✅ yes |
| `inspiration_bank` | ✅ yes |
| `brand_kit` | ❌ no |
| `calendar_events` | ✅ yes |
| `brand_material` | ✅ yes |

## Decisions for Phase 0.A

Columns confirmed missing from `schema.sql` and referenced by code
(from `docs/creative-direction-investigation.md` §2.1):

- `visual_style` — live
- `description` — NOT live — verify separately
- `logo_url` — live
- `calendar_events_generated_at` — live

Action: update `schema.sql` to include all columns flagged as
"live in DB, missing from schema.sql" above, plus emit a consolidation
migration (`ADD COLUMN IF NOT EXISTS`) that is no-op on production.
