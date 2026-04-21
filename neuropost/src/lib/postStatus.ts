// =============================================================================
// Single source of truth for `posts.status` semantics.
//
// Before this module each page hard-coded its own label map, which caused the
// same DB value to render differently on worker vs client ("Pendiente" vs
// "Para revisar"). Import from here instead of redeclaring locally.
//
// The DB layer is unchanged — this only unifies UI labels + colours.
// =============================================================================

export const POST_STATUSES = [
  'request',            // Initial client request — no content yet. Triggers auto-pipeline.
  'draft',              // Being prepared (generating image / caption).
  'generated',          // AI finished initial output — worker QC step.
  'pending',            // Ready — awaiting client approval.
  'approved',           // Client approved — ready to be scheduled.
  'scheduled',          // Has publish time set; cron will pick up.
  'published',          // Live on the platform.
  'failed',             // Publish attempt failed.
  'cancelled',          // Cancelled by user or worker.
  'needs_human_review', // QC flagged — worker must review.
] as const;

export type PostStatus = typeof POST_STATUSES[number];

// Human-readable explanation of each status — used for tooltips, docs, onboarding
export const POST_STATUS_DEFINITIONS: Record<PostStatus, string> = {
  request:            'Solicitud inicial del cliente. Dispara el pipeline de generación automática.',
  draft:              'El contenido se está preparando (generando imagen o caption).',
  generated:          'La IA ha producido un resultado inicial — el equipo lo revisa.',
  pending:            'Contenido listo, esperando que el cliente lo apruebe.',
  approved:           'Cliente ha aprobado — listo para programar.',
  scheduled:          'Con fecha de publicación fijada. El cron lo publicará.',
  published:          'Publicado en la red social.',
  failed:             'El intento de publicación falló. Revisar error_message.',
  cancelled:          'Cancelado por el usuario o el equipo.',
  needs_human_review: 'QC automático ha marcado el contenido — requiere revisión humana.',
};

// Labels rendered to the end-client (brand user). Focus: what they need to DO.
export const POST_STATUS_CLIENT_LABEL: Record<PostStatus, string> = {
  request:            'En preparación',
  draft:              'En preparación',
  generated:          'Para revisar',
  pending:            'Para revisar',
  approved:           'Para revisar',
  scheduled:          'Programado',
  published:          'Publicado',
  failed:             'Fallido',
  cancelled:          'Cancelado',
  needs_human_review: 'En revisión',
};

// Labels rendered to the internal worker. Focus: where in the pipeline it is.
export const POST_STATUS_WORKER_LABEL: Record<PostStatus, string> = {
  request:            'Solicitud del cliente',
  draft:              'Borrador',
  generated:          'Generado · QC pendiente',
  pending:            'Pendiente revisión cliente',
  approved:           'Aprobado por cliente',
  scheduled:          'Programado',
  published:          'Publicado',
  failed:             'Publicación fallida',
  cancelled:          'Cancelado',
  needs_human_review: 'Revisión humana requerida',
};

// Visual palette (dot, text, subtle bg). One shared chromatic language so a
// "pending" chip looks the same everywhere in the app.
export const POST_STATUS_STYLE: Record<PostStatus, { dot: string; text: string; bg: string }> = {
  request:            { dot: '#0D9488', text: '#0D9488', bg: '#f0fdfa' },
  draft:              { dot: '#0D9488', text: '#0D9488', bg: '#f0fdfa' },
  generated:          { dot: '#F59E0B', text: '#92400E', bg: '#fffbeb' },
  pending:            { dot: '#F59E0B', text: '#92400E', bg: '#fffbeb' },
  approved:           { dot: '#F59E0B', text: '#92400E', bg: '#fffbeb' },
  scheduled:          { dot: '#3B82F6', text: '#1e40af', bg: '#eff6ff' },
  published:          { dot: '#10B981', text: '#065f46', bg: '#ecfdf5' },
  failed:             { dot: '#EF4444', text: '#991b1b', bg: '#fef2f2' },
  cancelled:          { dot: '#9CA3AF', text: '#6b7280', bg: '#f9fafb' },
  needs_human_review: { dot: '#8B5CF6', text: '#5b21b6', bg: '#f5f3ff' },
};

// Convenience helper — pass the viewer's role to get the right label with a
// single call. Safe for unknown statuses (falls back to the raw string).
export function labelFor(status: string | null | undefined, role: 'client' | 'worker'): string {
  if (!status) return '';
  const table = role === 'client' ? POST_STATUS_CLIENT_LABEL : POST_STATUS_WORKER_LABEL;
  return (table as Record<string, string>)[status] ?? status;
}

export function styleFor(status: string | null | undefined) {
  if (!status) return POST_STATUS_STYLE.cancelled;
  return (POST_STATUS_STYLE as Record<string, typeof POST_STATUS_STYLE.pending>)[status]
    ?? POST_STATUS_STYLE.cancelled;
}
