-- =============================================================================
-- Sprint 2 — Email tracking columns on notifications
-- Adds Resend delivery metadata to in-app notifications so Sprint 5 can
-- correlate in-app records with outbound email sends.
-- =============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS email_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS email_resend_id text,
  ADD COLUMN IF NOT EXISTS email_error     text;

CREATE INDEX IF NOT EXISTS idx_notifications_email_sent
  ON notifications (email_sent_at)
  WHERE email_sent_at IS NOT NULL;

COMMENT ON COLUMN notifications.email_sent_at IS
  'Timestamp del envío exitoso vía Resend. NULL si es solo in-app o si todavía no se ha enviado.';

COMMENT ON COLUMN notifications.email_resend_id IS
  'ID del email en Resend. Útil para correlacionar con webhooks de entregabilidad.';

COMMENT ON COLUMN notifications.email_error IS
  'Mensaje de error del último intento de envío. NULL si fue exitoso.';
