-- =============================================================================
-- POSTLY — Advanced Agents Schema
-- Trends, Seasonal, Competitor, Churn
-- =============================================================================

-- ─── Trends ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trends (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sector      text NOT NULL,
  title       text,
  format      text,
  description text,
  viral_score int,
  expires_in  text,
  hashtags    text[],
  week_of     date,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_trends (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id            uuid REFERENCES brands(id) ON DELETE CASCADE,
  trend_id            uuid REFERENCES trends(id),
  adapted_caption     text,
  adapted_hashtags    text[],
  visual_instructions text,
  urgency             text,
  status              text DEFAULT 'suggested',
  -- 'suggested' | 'used' | 'ignored'
  post_id             uuid REFERENCES posts(id),
  created_at          timestamptz DEFAULT now()
);

-- ─── Seasonal ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasonal_dates (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  date_type    text,        -- 'fixed' | 'variable' | 'seasonal'
  month        int,
  day          int,         -- null if variable
  sectors      text[],      -- which sectors this applies to
  priority     text,        -- 'high' | 'medium' | 'low'
  days_advance int,         -- how many days in advance to prepare
  created_at   timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO seasonal_dates (name, date_type, month, day, sectors, priority, days_advance) VALUES
  ('Año Nuevo',           'fixed',    1,  1,  ARRAY['all'],                                           'high',   7),
  ('Reyes Magos',         'fixed',    1,  6,  ARRAY['all'],                                           'high',   7),
  ('Rebajas de enero',    'fixed',    1,  7,  ARRAY['boutique','moda'],                               'high',   3),
  ('Día de la Pizza',     'fixed',    2,  9,  ARRAY['restaurante','cafeteria'],                       'medium', 3),
  ('San Valentín',        'fixed',    2,  14, ARRAY['all'],                                           'high',   7),
  ('Operación bikini',    'seasonal', 3,  1,  ARRAY['gym','clinica'],                                 'high',   3),
  ('Nueva col P/V',       'fixed',    2,  15, ARRAY['boutique','moda'],                               'high',   5),
  ('Semana Santa',        'variable', NULL, NULL, ARRAY['all'],                                       'high',   7),
  ('Día del Trabajador',  'fixed',    5,  1,  ARRAY['all'],                                           'medium', 3),
  ('Inicio verano',       'seasonal', 6,  1,  ARRAY['all'],                                           'high',   5),
  ('Día del Helado',      'fixed',    7,  7,  ARRAY['heladeria'],                                     'high',   3),
  ('Rebajas de julio',    'fixed',    7,  1,  ARRAY['boutique','moda'],                               'high',   3),
  ('San Juan',            'fixed',    6,  24, ARRAY['restaurante','heladeria','cafeteria'],            'medium', 3),
  ('Asunción',            'fixed',    8,  15, ARRAY['all'],                                           'low',    1),
  ('Nueva col O/I',       'fixed',    8,  15, ARRAY['boutique','moda'],                               'high',   5),
  ('Vuelta al cole',      'seasonal', 9,  1,  ARRAY['gym','clinica','boutique'],                      'high',   5),
  ('Día del Café',        'fixed',    10, 1,  ARRAY['cafeteria','restaurante'],                       'medium', 3),
  ('Halloween',           'fixed',    10, 31, ARRAY['all'],                                           'medium', 5),
  ('Día Hispanidad',      'fixed',    10, 12, ARRAY['all'],                                           'low',    1),
  ('Todos los Santos',    'fixed',    11, 1,  ARRAY['all'],                                           'low',    1),
  ('Black Friday',        'variable', NULL, NULL, ARRAY['all'],                                       'high',   7),
  ('Inicio Navidad',      'seasonal', 12, 1,  ARRAY['all'],                                           'high',   5),
  ('Constitución',        'fixed',    12, 6,  ARRAY['all'],                                           'low',    1),
  ('Lotería de Navidad',  'fixed',    12, 22, ARRAY['all'],                                           'medium', 3),
  ('Navidad',             'fixed',    12, 25, ARRAY['all'],                                           'high',   7),
  ('Nochevieja',          'fixed',    12, 31, ARRAY['all'],                                           'high',   5)
ON CONFLICT DO NOTHING;

-- ─── Competitor Analysis ─────────────────────────────────────────────────────

ALTER TABLE brands ADD COLUMN IF NOT EXISTS competitors text[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS competitor_analysis (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id            uuid REFERENCES brands(id) ON DELETE CASCADE,
  competitor_username text,
  followers_count     int,
  avg_engagement      numeric,
  top_formats         jsonb,
  top_topics          jsonb,
  posting_frequency   text,
  strengths           jsonb,
  weaknesses          jsonb,
  opportunity_gaps    text,
  content_ideas       jsonb,
  analyzed_at         timestamptz DEFAULT now()
);

-- ─── Churn ───────────────────────────────────────────────────────────────────

ALTER TABLE brands ADD COLUMN IF NOT EXISTS churn_score           int DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS churn_risk            text DEFAULT 'low';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS last_login_at         timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS last_post_published_at timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS rejected_in_a_row     int DEFAULT 0;

CREATE TABLE IF NOT EXISTS churn_actions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id             uuid REFERENCES brands(id) ON DELETE CASCADE,
  action_type          text,
  -- 'email_medium' | 'email_high' | 'email_critical' | 'manual_call' | 'discount_offered'
  churn_score_at_action int,
  email_subject        text,
  email_body           text,
  discount_code        text,
  result               text DEFAULT 'pending',
  -- 'no_response' | 'reactivated' | 'cancelled' | 'pending'
  created_at           timestamptz DEFAULT now(),
  resolved_at          timestamptz
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trends_sector_week   ON trends (sector, week_of);
CREATE INDEX IF NOT EXISTS idx_brand_trends_brand   ON brand_trends (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_comp_analysis_brand  ON competitor_analysis (brand_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_churn_actions_brand  ON churn_actions (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brands_churn_risk    ON brands (churn_risk, churn_score);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE trends              ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_trends        ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_actions       ENABLE ROW LEVEL SECURITY;

-- brand_trends: owner can read their own
CREATE POLICY "brand_trends_select" ON brand_trends FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "brand_trends_update" ON brand_trends FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- competitor_analysis: owner can read
CREATE POLICY "comp_analysis_select" ON competitor_analysis FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

-- trends: anyone authenticated can read
CREATE POLICY "trends_select" ON trends FOR SELECT USING (auth.uid() IS NOT NULL);

-- churn_actions: superadmin only (via service role)
CREATE POLICY "churn_actions_select" ON churn_actions FOR SELECT USING (is_superadmin());
