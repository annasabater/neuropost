-- NeuroPost Worker Portal — Database Schema
-- Run this in your Supabase SQL editor

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  full_name text,
  email text,
  role text DEFAULT 'worker' CHECK (role IN ('worker', 'senior', 'admin')),
  avatar_url text,
  is_active boolean DEFAULT true,
  brands_assigned uuid[] DEFAULT '{}',
  specialties text[] DEFAULT '{}',
  notes text,
  joined_at timestamptz DEFAULT now()
);

-- Content validation queue
CREATE TABLE IF NOT EXISTS content_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  type text DEFAULT 'ai_proposal' CHECK (type IN ('edit_request', 'ai_proposal', 'direct')),
  status text DEFAULT 'pending_worker' CHECK (status IN (
    'pending_worker', 'worker_approved', 'worker_rejected',
    'sent_to_client', 'client_approved', 'client_rejected'
  )),
  assigned_worker_id uuid REFERENCES workers(id),
  worker_notes text,
  worker_reviewed_at timestamptz,
  client_feedback text,
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  regeneration_count int DEFAULT 0,
  regeneration_history jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Feed ordering queue
CREATE TABLE IF NOT EXISTS feed_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id),
  image_url text,
  position int NOT NULL DEFAULT 0,
  is_published boolean DEFAULT false,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Internal client notes (worker-only)
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES workers(id),
  note text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Internal team messages
CREATE TABLE IF NOT EXISTS worker_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id),
  from_worker_id uuid REFERENCES workers(id),
  to_worker_id uuid REFERENCES workers(id),
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Client activity log (visible to workers)
CREATE TABLE IF NOT EXISTS client_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Extend posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS requires_worker_validation boolean DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_edit_mode text DEFAULT 'proposal' CHECK (client_edit_mode IN ('proposal', 'instant'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS client_notes_for_worker text;

-- RLS policies (workers see their assigned brands)
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;

-- Workers can see all content (service role bypasses RLS in API routes)
-- Brand owners can see their own feed queue
CREATE POLICY IF NOT EXISTS "Brand owners can read their feed_queue"
  ON feed_queue FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Brand owners can update their feed_queue"
  ON feed_queue FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_brand ON content_queue(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_worker ON content_queue(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_feed_queue_brand ON feed_queue(brand_id, position);
CREATE INDEX IF NOT EXISTS idx_client_activity_brand ON client_activity_log(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_messages_to ON worker_messages(to_worker_id, read);
