-- ═══════════════════════════════════════════════════════════════════════════
-- Equipo Workers — unifica acceso al portal /worker sobre la tabla `workers`
-- ═══════════════════════════════════════════════════════════════════════════
-- Antes de esto hab\u00eda dos tablas descoladas: `workers` (la que gatea el
-- acceso v\u00eda lib/worker.ts/getWorker) y `portal_workers` (usada por el tab
-- Equipo pero sin efecto sobre el gate). Esta migraci\u00f3n:
--   1. A\u00f1ade `added_by` a `workers` para trazabilidad.
--   2. A\u00f1ade \u00edndice por is_active para los listados del tab Equipo.
--   3. Deja `portal_workers` hu\u00e9rfana (no la borra por seguridad).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workers_is_active ON workers(is_active);
CREATE INDEX IF NOT EXISTS idx_workers_joined_at ON workers(joined_at DESC);

-- Nota: `portal_workers` queda hu\u00e9rfana intencionadamente. No la borramos
-- por si contiene datos que quieras recuperar. La tabla Equipo ya no la
-- referencia en el c\u00f3digo.
