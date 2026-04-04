-- =============================================================================
-- POSTLY — Admin Panel Schema
-- Ejecuta en Supabase Dashboard → SQL Editor → New query
-- =============================================================================

-- ─── Add role to profiles ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
-- role: 'user' | 'superadmin'

-- Helper function for RLS policies
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Prospects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_account_id   text,
  username        text,
  full_name       text,
  profile_pic_url text,
  bio             text,
  followers       int  DEFAULT 0,
  following       int  DEFAULT 0,
  post_count      int  DEFAULT 0,
  sector          text,
  city            text,
  email           text,
  website         text,
  channel         text DEFAULT 'instagram',  -- 'instagram'|'email'|'meta_ads'
  status          text DEFAULT 'contacted',  -- 'contacted'|'replied'|'interested'|'converted'|'not_interested'
  notes           text,
  last_activity   timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospects: superadmin only"
  ON public.prospects FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_prospects_status   ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_channel  ON public.prospects(channel);
CREATE INDEX IF NOT EXISTS idx_prospects_username ON public.prospects(username);

-- ─── Outbound comments (comments Postly sends on prospects' IG posts) ─────────
CREATE TABLE IF NOT EXISTS public.outbound_comments (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id               uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  ig_post_url               text,
  ig_post_id                text,
  comment_ig_id             text,           -- our comment's ID returned by IG
  content                   text NOT NULL,
  prospect_reply            text,
  prospect_reply_id         text,
  prospect_reply_liked      boolean DEFAULT false,
  prospect_reply_liked_at   timestamptz,
  status                    text DEFAULT 'sent',  -- 'sent'|'replied'|'ignored'
  sent_at                   timestamptz DEFAULT now(),
  replied_at                timestamptz
);

ALTER TABLE public.outbound_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_comments: superadmin only"
  ON public.outbound_comments FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_outbound_comments_prospect ON public.outbound_comments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outbound_comments_status   ON public.outbound_comments(status);

-- ─── Messages (DMs and emails received from prospects) ────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform            text DEFAULT 'instagram',   -- 'instagram'|'facebook'|'email'
  external_id         text UNIQUE,
  thread_id           text,
  sender_username     text,
  sender_id           text,
  content             text,
  our_reply           text,
  status              text DEFAULT 'unread',       -- 'unread'|'read'|'replied'|'archived'
  ai_reply_suggestion text,
  prospect_id         uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  replied_at          timestamptz
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages: superadmin only"
  ON public.messages FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_messages_platform   ON public.messages(platform);
CREATE INDEX IF NOT EXISTS idx_messages_status     ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id  ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_prospect   ON public.messages(prospect_id);

-- ─── Prospect interactions (full timeline) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospect_interactions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id  uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  type         text NOT NULL,
  -- 'comment_sent'|'comment_reply_received'|'email_sent'|'email_opened'
  -- 'email_replied'|'dm_received'|'dm_sent'|'status_changed'|'ad_lead'|'note_added'
  content      text,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.prospect_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interactions: superadmin only"
  ON public.prospect_interactions FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE INDEX IF NOT EXISTS idx_interactions_prospect ON public.prospect_interactions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type     ON public.prospect_interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created  ON public.prospect_interactions(created_at DESC);

-- ─── Enable Realtime for activity feed ────────────────────────────────────────
-- Run in Supabase Dashboard → Database → Replication → Add tables:
-- prospects, messages, prospect_interactions
