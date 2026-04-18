// =============================================================================
// NEUROPOST — Public unsubscribe confirmation page
// GET /unsubscribe?token=<uuid>&type=<type>
// Flips notification_preferences.{type}_email to false.
// =============================================================================

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// Whitelist of pref columns we are allowed to flip from the public endpoint.
// Must match `PREF_COLUMN` in src/lib/email/preferences.ts.
const TYPE_TO_PREF: Record<string, string> = {
  approval_needed:       'approval_needed_email',
  ticket_reply:          'ticket_reply_email',
  chat_message:          'chat_message_email',
  recreation_ready:      'recreation_ready_email',
  comment_pending:       'comment_pending_email',
  token_expired:         'token_expired_email',
  post_published:        'post_published_email',
  post_failed:           'post_failed_email',
  payment_failed:        'payment_failed_email',
  trial_ending:          'trial_ending_email',
  limit_reached:         'limit_reached_email',
  reactivation:          'reactivation_email',
  no_content:            'no_content_email',
  onboarding_incomplete: 'onboarding_incomplete_email',
  no_social_connected:   'no_social_connected_email',
  plan_unused:           'plan_unused_email',
  weekly_report:         'weekly_report_email',
  monthly_report:        'monthly_report_email',
  daily_digest:          'daily_digest_email',
  marketing:             'marketing_email',
  product_updates:       'product_updates_email',
  newsletter:            'newsletter_email',
};

const TYPE_LABEL: Record<string, string> = {
  approval_needed:       'contenido pendiente de aprobación',
  ticket_reply:          'respuestas de soporte',
  chat_message:          'mensajes del equipo',
  recreation_ready:      'recreaciones listas',
  comment_pending:       'comentarios pendientes',
  token_expired:         'avisos de conexión caducada',
  post_published:        'posts publicados',
  post_failed:           'errores de publicación',
  payment_failed:        'avisos de pago',
  trial_ending:          'avisos de fin de prueba',
  limit_reached:         'avisos de límite alcanzado',
  reactivation:          'recordatorios de reactivación',
  no_content:            'recordatorios de contenido',
  onboarding_incomplete: 'recordatorios de configuración',
  no_social_connected:   'recordatorios de conexión de redes',
  plan_unused:           'avisos de plan sin uso',
  weekly_report:         'informes semanales',
  monthly_report:        'informes mensuales',
  daily_digest:          'resumen diario',
  marketing:             'comunicaciones comerciales',
  product_updates:       'novedades del producto',
  newsletter:            'newsletter',
};

type Props = { searchParams: Promise<{ token?: string; type?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const params = await searchParams;
  const token  = params.token?.trim();
  const type   = params.type?.trim();

  if (!token || !type) return renderError('Link inválido — falta token o tipo.');
  const prefColumn = TYPE_TO_PREF[type];
  if (!prefColumn) return renderError(`Tipo de email no reconocido: ${type}.`);

  const db = createAdminClient() as DB;

  // Validate token → resolve brand
  const { data: tokenRow } = await db
    .from('email_unsubscribe_tokens')
    .select('token, brand_id')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow) return renderError('Este link ya no es válido o ha expirado.');

  // Flip the toggle (upsert to handle brands with no preferences row yet)
  const { error } = await db
    .from('notification_preferences')
    .upsert(
      { brand_id: tokenRow.brand_id, [prefColumn]: false, updated_at: new Date().toISOString() },
      { onConflict: 'brand_id' },
    );

  if (error) {
    return renderError(`No pudimos guardar tu preferencia: ${error.message}`);
  }

  // Touch last_used_at for auditing
  await db
    .from('email_unsubscribe_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token);

  return renderSuccess(type);
}

function renderSuccess(type: string) {
  const label = TYPE_LABEL[type] ?? 'este tipo de emails';
  return (
    <Shell>
      <h1 style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px', color: 'var(--text-primary)' }}>
        Te hemos dado de baja
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px' }}>
        Ya no recibirás más emails sobre <strong>{label}</strong>.
      </p>
      <Link href="/settings?tab=notificaciones" style={ctaStyle}>
        Gestionar todas las preferencias →
      </Link>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 20 }}>
        ¿Te has equivocado? Puedes reactivarlos desde Ajustes en cualquier momento.
      </p>
    </Shell>
  );
}

function renderError(message: string) {
  return (
    <Shell>
      <h1 style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 28, fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px', color: 'var(--text-primary)' }}>
        Link no válido
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 28px' }}>
        {message}
      </p>
      <Link href="/settings?tab=notificaciones" style={ctaStyle}>
        Ir a Ajustes de notificaciones →
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg-1)',
    }}>
      <div style={{
        maxWidth: 520, width: '100%', padding: '48px 40px',
        background: 'var(--bg)', border: '1px solid var(--border)',
      }}>
        {children}
      </div>
    </div>
  );
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 22px',
  background: 'var(--accent)',
  color: '#fff',
  textDecoration: 'none',
  fontFamily: "var(--font-barlow-condensed), sans-serif",
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
};
