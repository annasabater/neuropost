-- Referencias de inspiración guardadas por el cliente
CREATE TABLE inspiration_references (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  type text,
  -- 'url' | 'upload' | 'template'
  source_url text,
  thumbnail_url text,
  title text,
  notes text,
  sector text,
  style_tags text[],
  format text,
  -- 'image' | 'reel' | 'carousel' | 'story'
  is_saved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Solicitudes de recreación
CREATE TABLE recreation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  reference_id uuid REFERENCES inspiration_references(id),
  post_id uuid REFERENCES posts(id),
  client_notes text,
  style_to_adapt text[],
  status text DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'completed' | 'rejected'
  worker_notes text,
  created_at timestamptz DEFAULT now()
);

-- Plantillas de NeuroPost por sector
CREATE TABLE inspiration_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  sectors text[],
  styles text[],
  format text,
  prompt_template text,
  tags text[],
  is_active boolean DEFAULT true,
  times_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inspiration_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE recreation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own inspirations" ON inspiration_references
  USING (brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  ));

CREATE POLICY "Own recreations" ON recreation_requests
  USING (brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  ));

CREATE INDEX inspiration_references_brand_id_idx ON inspiration_references(brand_id);
CREATE INDEX recreation_requests_brand_id_idx ON recreation_requests(brand_id);
CREATE INDEX recreation_requests_status_idx ON recreation_requests(status);
CREATE INDEX inspiration_templates_is_active_idx ON inspiration_templates(is_active);
