-- ═══════════════════════════════════════════════════════════════════════════════
-- Worker Portal — Complete SQL Migration
-- Tables that DON'T exist yet. Uses IF NOT EXISTS everywhere.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── worker_profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_profiles (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name  text NOT NULL,
  email         text NOT NULL,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'worker' CHECK (role IN ('owner','admin','senior','worker','viewer')),
  department    text CHECK (department IN ('content','community','sales','support','management')),
  is_active     boolean DEFAULT true,
  permissions   jsonb DEFAULT '{}',
  last_login_at timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── worker_assignments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_assignments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id     uuid REFERENCES worker_profiles(id) ON DELETE CASCADE NOT NULL,
  brand_id      uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  role_in_brand text DEFAULT 'content' CHECK (role_in_brand IN ('content','community','account_manager','all')),
  is_primary    boolean DEFAULT false,
  assigned_at   timestamptz DEFAULT now(),
  assigned_by   uuid REFERENCES worker_profiles(id),
  UNIQUE(worker_id, brand_id)
);

-- ── tickets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number     text UNIQUE,
  brand_id          uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  user_id           uuid NOT NULL,
  assigned_worker_id uuid REFERENCES worker_profiles(id),
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('feedback_widget','email','chat','comment_escalation','system','manual')),
  category          text NOT NULL DEFAULT 'general_question' CHECK (category IN ('bug','feature_request','content_complaint','billing','connection_issue','general_question','content_request','urgent','account','other')),
  priority          text DEFAULT 'normal' CHECK (priority IN ('critical','high','normal','low')),
  status            text DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','waiting_user','waiting_internal','resolved','closed','reopened')),
  subject           text NOT NULL,
  description       text NOT NULL DEFAULT '',
  attachments       text[] DEFAULT '{}',
  tags              text[] DEFAULT '{}',
  related_post_id   uuid,
  related_comment_id uuid,
  resolution_notes  text,
  satisfaction_rating integer CHECK (satisfaction_rating BETWEEN 1 AND 5),
  first_response_at timestamptz,
  resolved_at       timestamptz,
  closed_at         timestamptz,
  sla_deadline      timestamptz,
  sla_breached      boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status) WHERE status NOT IN ('closed','resolved');
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_worker_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_brand ON tickets(brand_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority) WHERE priority IN ('critical','high');

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number() RETURNS TRIGGER AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM tickets;
  NEW.ticket_number := 'TK-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_number ON tickets;
CREATE TRIGGER trg_ticket_number BEFORE INSERT ON tickets
  FOR EACH ROW WHEN (NEW.ticket_number IS NULL) EXECUTE FUNCTION generate_ticket_number();

-- ── ticket_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id       uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  sender_type     text NOT NULL CHECK (sender_type IN ('user','worker','system','agent')),
  sender_id       uuid,
  sender_name     text NOT NULL DEFAULT 'Sistema',
  message         text NOT NULL,
  attachments     text[] DEFAULT '{}',
  is_internal_note boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

-- ── user_messages (chat directo usuario-equipo) ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id        uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  user_id         uuid NOT NULL,
  worker_id       uuid REFERENCES worker_profiles(id),
  direction       text NOT NULL CHECK (direction IN ('user_to_team','team_to_user')),
  message         text NOT NULL,
  attachments     text[] DEFAULT '{}',
  is_read_by_user boolean DEFAULT false,
  is_read_by_team boolean DEFAULT false,
  read_by_user_at timestamptz,
  read_by_team_at timestamptz,
  related_post_id uuid,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_messages_brand ON user_messages(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_messages_unread ON user_messages(is_read_by_team) WHERE is_read_by_team = false;

-- ── agent_activity_feed ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_activity_feed (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent              text NOT NULL,
  brand_id           uuid REFERENCES brands(id) ON DELETE CASCADE,
  action_type        text NOT NULL,
  title              text NOT NULL,
  details            jsonb DEFAULT '{}',
  severity           text DEFAULT 'info' CHECK (severity IN ('info','warning','error','success')),
  brand_name         text,
  thumbnail_url      text,
  requires_attention boolean DEFAULT false,
  attended_by        uuid REFERENCES worker_profiles(id),
  attended_at        timestamptz,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_time ON agent_activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_attention ON agent_activity_feed(requires_attention) WHERE requires_attention = true;
CREATE INDEX IF NOT EXISTS idx_activity_feed_agent ON agent_activity_feed(agent, created_at DESC);

-- ── worker_actions_log (auditoría) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_actions_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id   uuid REFERENCES worker_profiles(id) NOT NULL,
  action      text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('post','comment','ticket','brand','proposal','message','report')),
  target_id   uuid NOT NULL,
  brand_id    uuid REFERENCES brands(id),
  details     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_actions_worker ON worker_actions_log(worker_id, created_at DESC);

-- ── worker_metrics_daily ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_metrics_daily (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id                 uuid REFERENCES worker_profiles(id) NOT NULL,
  date                      date NOT NULL,
  posts_validated           integer DEFAULT 0,
  posts_edited              integer DEFAULT 0,
  posts_rejected            integer DEFAULT 0,
  captions_rewritten        integer DEFAULT 0,
  comments_handled          integer DEFAULT 0,
  tickets_responded         integer DEFAULT 0,
  tickets_resolved          integer DEFAULT 0,
  messages_sent             integer DEFAULT 0,
  avg_response_time_minutes decimal(10,2),
  time_active_minutes       integer DEFAULT 0,
  created_at                timestamptz DEFAULT now(),
  UNIQUE(worker_id, date)
);

-- ── client_health_scores ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_health_scores (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id                uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL UNIQUE,
  health_score            integer DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  risk_level              text DEFAULT 'normal' CHECK (risk_level IN ('healthy','normal','at_risk','critical')),
  factors                 jsonb DEFAULT '{}',
  approval_rate_30d       decimal(5,2),
  avg_approval_time_hours decimal(10,2),
  posts_approved_30d      integer DEFAULT 0,
  posts_rejected_30d      integer DEFAULT 0,
  open_tickets            integer DEFAULT 0,
  churn_prediction        decimal(5,4),
  notes                   text,
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_health_risk ON client_health_scores(risk_level) WHERE risk_level IN ('at_risk','critical');

-- ── internal_notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_notes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id    uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  worker_id   uuid REFERENCES worker_profiles(id) NOT NULL,
  note        text NOT NULL,
  category    text DEFAULT 'general' CHECK (category IN ('general','content_preference','complaint_history','special_instructions','billing','personality','important')),
  is_pinned   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_notes_brand ON internal_notes(brand_id, created_at DESC);

-- ── canned_responses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canned_responses (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  content     text NOT NULL,
  category    text CHECK (category IN ('greeting','billing','technical','content','onboarding','closing','general')),
  variables   text[] DEFAULT '{}',
  usage_count integer DEFAULT 0,
  created_by  uuid REFERENCES worker_profiles(id),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ── agent_configs (editable agent configuration) ─────────────────────────────
CREATE TABLE IF NOT EXISTS agent_configs (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent                text NOT NULL UNIQUE,
  is_active            boolean DEFAULT true,
  system_prompt        text,
  model                text DEFAULT 'claude-sonnet-4-20250514',
  cron_schedule        text,
  max_daily_cost_usd   decimal(10,2) DEFAULT 50.00,
  max_monthly_cost_usd decimal(10,2) DEFAULT 500.00,
  max_retries          integer DEFAULT 3,
  timeout_seconds      integer DEFAULT 25,
  concurrency_limit    integer DEFAULT 5,
  custom_config        jsonb DEFAULT '{}',
  updated_by           uuid REFERENCES worker_profiles(id),
  updated_at           timestamptz DEFAULT now()
);

-- Seed default agent configs
INSERT INTO agent_configs (agent, cron_schedule) VALUES
  ('strategist', '0 3 * * 1'),
  ('copywriter', '*/5 * * * *'),
  ('visual_generator', '*/3 * * * *'),
  ('quality_control', '*/3 * * * *'),
  ('community_manager', '*/2 * * * *'),
  ('analytics', '0 6 1 * *'),
  ('health_check', '*/15 * * * *'),
  ('token_renovator', '0 */12 * * *')
ON CONFLICT (agent) DO NOTHING;

-- ── agent_prompt_versions (prompt history) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_prompt_versions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent          text NOT NULL,
  version        integer NOT NULL,
  system_prompt  text NOT NULL,
  change_reason  text,
  changed_by     uuid REFERENCES worker_profiles(id),
  is_active      boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(agent, version)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Triggers for agent_activity_feed
-- ═══════════════════════════════════════════════════════════════════════════════

-- Log post status changes to feed
CREATE OR REPLACE FUNCTION log_post_to_feed() RETURNS TRIGGER AS $$
DECLARE v_brand text; v_sev text; v_att boolean;
BEGIN
  SELECT name INTO v_brand FROM brands WHERE id = NEW.brand_id;
  v_sev := CASE NEW.status
    WHEN 'published' THEN 'success' WHEN 'failed' THEN 'error'
    WHEN 'cancelled' THEN 'warning' ELSE 'info' END;
  v_att := NEW.status IN ('failed','cancelled');

  INSERT INTO agent_activity_feed (agent, brand_id, action_type, title, severity, brand_name, requires_attention, details)
  VALUES ('pipeline', NEW.brand_id,
    CASE NEW.status WHEN 'published' THEN 'post_published' WHEN 'failed' THEN 'post_failed' WHEN 'generated' THEN 'qc_approved' ELSE 'post_status_change' END,
    COALESCE(v_brand, '') || ': ' || COALESCE(NEW.caption, NEW.status),
    v_sev, v_brand, v_att,
    jsonb_build_object('post_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status));
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_feed ON posts;
CREATE TRIGGER trg_post_feed AFTER UPDATE OF status ON posts
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION log_post_to_feed();

-- Log escalated comments to feed
CREATE OR REPLACE FUNCTION log_comment_to_feed() RETURNS TRIGGER AS $$
DECLARE v_brand text;
BEGIN
  IF NEW.status = 'escalated' THEN
    SELECT name INTO v_brand FROM brands WHERE id = NEW.brand_id;
    INSERT INTO agent_activity_feed (agent, brand_id, action_type, title, severity, brand_name, requires_attention, details)
    VALUES ('community_manager', NEW.brand_id, 'comment_escalated',
      COALESCE(v_brand,'') || ': Comentario escalado',
      'warning', v_brand, true,
      jsonb_build_object('comment_id', NEW.id, 'text', LEFT(COALESCE(NEW.content, ''), 100)));
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_feed ON comments;
CREATE TRIGGER trg_comment_feed AFTER INSERT OR UPDATE OF status ON comments
  FOR EACH ROW EXECUTE FUNCTION log_comment_to_feed();

-- Log new tickets to feed
CREATE OR REPLACE FUNCTION log_ticket_to_feed() RETURNS TRIGGER AS $$
DECLARE v_brand text;
BEGIN
  SELECT name INTO v_brand FROM brands WHERE id = NEW.brand_id;
  INSERT INTO agent_activity_feed (agent, brand_id, action_type, title, severity, brand_name, requires_attention, details)
  VALUES ('system', NEW.brand_id, 'request_received',
    COALESCE(v_brand,'') || ': ' || NEW.subject,
    CASE NEW.priority WHEN 'critical' THEN 'error' WHEN 'high' THEN 'warning' ELSE 'info' END,
    v_brand, true,
    jsonb_build_object('ticket_id', NEW.id, 'ticket_number', NEW.ticket_number, 'priority', NEW.priority));
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ticket_feed ON tickets;
CREATE TRIGGER trg_ticket_feed AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_to_feed();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Enable Realtime for key tables
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE agent_activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE user_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_messages;
