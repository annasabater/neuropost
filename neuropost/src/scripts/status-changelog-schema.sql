-- Service incidents
CREATE TABLE IF NOT EXISTS service_incidents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'minor', -- 'minor' | 'major' | 'critical'
  status text DEFAULT 'investigating', -- 'investigating' | 'identified' | 'monitoring' | 'resolved'
  affected_services text[] DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid REFERENCES service_incidents(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS status_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  confirmed boolean DEFAULT true,
  confirm_token text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text,
  title text NOT NULL,
  summary text,
  changes jsonb DEFAULT '[]', -- [{type:'new'|'improved'|'fixed'|'removed', text:'...'}]
  is_published boolean DEFAULT false,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON service_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON service_incidents(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog_entries(is_published, published_at DESC);
