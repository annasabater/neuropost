-- =============================================================================
-- Migration: Tabla incidencias_soporte
-- =============================================================================
-- Registra escalaciones automáticas del CommunityAgent cuando detecta
-- mensajes agresivos o que requieren intervención humana.

CREATE TABLE IF NOT EXISTS public.incidencias_soporte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES brands(id),
  job_id UUID,                              -- agent_jobs.id que generó la escalación
  usuario_id TEXT,                           -- ID o nombre del usuario
  plan_usuario TEXT DEFAULT 'desconocido',
  nivel_escalada SMALLINT NOT NULL DEFAULT 2 CHECK (nivel_escalada BETWEEN 2 AND 3),
  motivo TEXT NOT NULL,                      -- Resumen de 1 línea
  mensaje_original TEXT,                     -- Texto del mensaje del cliente
  respuesta_agente TEXT,                     -- Respuesta de de-escalación generada
  extracto_mensajes JSONB DEFAULT '[]'::jsonb,
  accion_tomada TEXT NOT NULL DEFAULT 'derivada',  -- "derivada" o "cerrada"
  source TEXT,                               -- 'chat', 'ticket', 'comment'
  email_enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: solo service_role puede acceder
ALTER TABLE public.incidencias_soporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert" ON public.incidencias_soporte
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_role_select" ON public.incidencias_soporte
  FOR SELECT USING (true);

-- Index para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_incidencias_brand
  ON incidencias_soporte(brand_id, created_at DESC);
