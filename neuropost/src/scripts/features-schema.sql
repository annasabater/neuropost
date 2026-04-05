-- Chat client <-> worker
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  sender_type text, -- 'client' | 'worker'
  message text,
  attachments jsonb DEFAULT '[]',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Special requests
CREATE TABLE IF NOT EXISTS special_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text, -- 'campaign' | 'seasonal' | 'custom' | 'urgent' | 'consultation' | 'other'
  status text DEFAULT 'pending', -- 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected'
  assigned_worker_id uuid REFERENCES workers(id),
  worker_response text,
  deadline_at timestamptz,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Onboarding progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE UNIQUE,
  steps_completed text[] DEFAULT '{}',
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text,
  category text, -- 'billing' | 'technical' | 'instagram' | 'content' | 'account' | 'other'
  priority text DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
  status text DEFAULT 'open', -- 'open' | 'in_progress' | 'resolved' | 'closed'
  assigned_worker_id uuid REFERENCES workers(id),
  resolution text,
  satisfaction_rating integer, -- 1-5
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  sender_type text, -- 'client' | 'worker'
  message text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own chat" ON chat_messages FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Own requests" ON special_requests FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Own onboarding" ON onboarding_progress FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Own tickets" ON support_tickets FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Own ticket messages" ON support_ticket_messages FOR ALL
  USING (ticket_id IN (
    SELECT id FROM support_tickets WHERE brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_brand_id ON chat_messages(brand_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_requests_brand_id ON special_requests(brand_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_brand_id ON support_tickets(brand_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
