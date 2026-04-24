# Phase 0.A — Brands column types (detailed)

**Source:** inference from 6 sample rows

## Method

Inferred from a sample of 6 rows. **Types marked below are best-guess** based on JS values observed. Nullability is `true` if any sampled row had `null` for that column — for `false`, the column could still be nullable (just not observed null in the sample). Run the SQL block at the bottom of this file to confirm authoritative types before applying the migration.

## Columns

| Column | Inferred type | Nullable in sample | # non-null samples |
|---|---|---|---|
| `ai_disclosure_committed_at` | `timestamptz` | yes | 0/6 |
| `auto_approve_after_days` | `integer` | no | 6/6 |
| `auto_publish` | `boolean` | no | 6/6 |
| `brand_voice_doc` | `text` | no | 6/6 |
| `brief_completion_pct` | `integer` | no | 6/6 |
| `calendar_events_generated_at` | `timestamptz` | yes | 3/6 |
| `churn_risk` | `text` | no | 6/6 |
| `churn_score` | `integer` | no | 6/6 |
| `city` | `text /* all-null sample, confirm in DB */` | yes | 0/6 |
| `colors` | `jsonb` | no | 6/6 |
| `competitors` | `text[]` | no | 6/6 |
| `compliance_flags` | `jsonb` | no | 6/6 |
| `content_mix_preferences` | `jsonb` | no | 6/6 |
| `created_at` | `timestamptz` | no | 6/6 |
| `dpa_accepted_at` | `timestamptz` | yes | 0/6 |
| `faq` | `text /* all-null sample, confirm in DB */` | yes | 0/6 |
| `fb_access_token` | `text` | yes | 0/6 |
| `fb_page_id` | `text` | yes | 0/6 |
| `fb_page_name` | `text` | yes | 0/6 |
| `first_content_at` | `timestamptz` | yes | 1/6 |
| `fonts` | `text /* all-null sample, confirm in DB */` | yes | 0/6 |
| `hashtags` | `text[]` | no | 6/6 |
| `human_review_config` | `jsonb` | yes | 4/6 |
| `id` | `uuid` | no | 6/6 |
| `ig_access_token` | `text` | yes | 0/6 |
| `ig_account_id` | `text` | yes | 0/6 |
| `ig_username` | `text` | yes | 0/6 |
| `last_login_at` | `timestamptz` | yes | 0/6 |
| `last_no_content_email_at` | `timestamptz` | yes | 2/6 |
| `last_no_social_email_at` | `timestamptz` | yes | 5/6 |
| `last_onboarding_email_at` | `timestamptz` | no | 6/6 |
| `last_plan_unused_email_at` | `timestamptz` | yes | 0/6 |
| `last_post_published_at` | `timestamptz` | yes | 0/6 |
| `last_reactivation_email_at` | `timestamptz` | yes | 0/6 |
| `location` | `text` | no | 6/6 |
| `logo_url` | `text` | yes | 0/6 |
| `marketing_consent` | `boolean` | no | 6/6 |
| `marketing_consent_at` | `timestamptz` | yes | 1/6 |
| `meta_token_expires_at` | `timestamptz` | yes | 0/6 |
| `name` | `text` | no | 6/6 |
| `notify_email_comments` | `boolean` | no | 6/6 |
| `notify_email_publish` | `boolean` | no | 6/6 |
| `onboarding_content_triggered` | `boolean` | no | 6/6 |
| `plan` | `text` | no | 6/6 |
| `plan_cancels_at` | `timestamptz` | yes | 0/6 |
| `plan_started_at` | `timestamptz` | yes | 0/6 |
| `posts_this_week` | `integer` | no | 6/6 |
| `publish_mode` | `text` | no | 6/6 |
| `purchased_extra_accounts` | `integer` | no | 6/6 |
| `rejected_in_a_row` | `integer` | no | 6/6 |
| `require_worker_review` | `boolean` | no | 6/6 |
| `rules` | `jsonb` | no | 6/6 |
| `secondary_sectors` | `text[]` | no | 6/6 |
| `sector` | `text` | no | 6/6 |
| `services` | `text[]` | no | 6/6 |
| `slogans` | `text[]` | no | 6/6 |
| `stories_this_week` | `integer` | no | 6/6 |
| `stripe_customer_id` | `text` | yes | 0/6 |
| `stripe_subscription_id` | `text` | yes | 0/6 |
| `subscribed_platforms` | `text[]` | no | 6/6 |
| `tone` | `text` | no | 6/6 |
| `trial_ends_at` | `timestamptz` | yes | 0/6 |
| `tt_access_token` | `text` | yes | 1/6 |
| `tt_open_id` | `text` | yes | 1/6 |
| `tt_refresh_token` | `text` | yes | 1/6 |
| `tt_token_expires_at` | `timestamptz` | yes | 1/6 |
| `tt_username` | `text` | yes | 1/6 |
| `use_new_planning_flow` | `boolean` | no | 6/6 |
| `user_id` | `uuid` | no | 6/6 |
| `visual_style` | `text` | no | 6/6 |
| `week_reset_at` | `timestamptz` | no | 6/6 |

## Authoritative SQL to run in Supabase SQL Editor

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='brands'
ORDER BY ordinal_position;
```

Paste the result below when available:

```
(pending user paste)
```
